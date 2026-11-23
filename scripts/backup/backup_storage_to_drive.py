#!/usr/bin/env python3
"""Back up every object in the JFDRMS Supabase Storage buckets to Google Drive.

The service-role key and Google service-account JSON are read only from environment
secrets. No object bytes, credentials, or signed URLs are logged.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from datetime import datetime
from io import BytesIO
from zoneinfo import ZoneInfo

import requests
from google.oauth2.service_account import Credentials
from google.auth.transport.requests import Request

BUCKETS = {
    "preplan-files": "Preplan Photos",
    "inspection-attachments": "Inspection Attachments",
}
DRIVE_API = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"
CHUNK_SIZE = 5 * 1024 * 1024
HTTP = requests.Session()


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required GitHub Actions secret: {name}")
    return value


def drive_headers() -> dict[str, str]:
    raw = required("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON")
    info = json.loads(raw)
    creds = Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/drive"]
    )
    creds.refresh(Request())
    return {"Authorization": f"Bearer {creds.token}"}


def drive_request(method: str, url: str, **kwargs):
    headers = kwargs.pop("headers", {})
    headers.update(drive_headers())
    response = HTTP.request(method, url, headers=headers, timeout=300, **kwargs)
    response.raise_for_status()
    return response


def q_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


def find_folder(name: str, parent_id: str) -> str | None:
    query = (
        "mimeType='application/vnd.google-apps.folder' and trashed=false "
        f"and name='{q_escape(name)}' and '{q_escape(parent_id)}' in parents"
    )
    data = drive_request(
        "GET", f"{DRIVE_API}/files",
        params={"q": query, "pageSize": 100, "fields": "files(id,name)"},
    ).json()
    folders = data.get("files", [])
    if len(folders) > 1:
        raise RuntimeError(f"Multiple Drive folders named {name!r} exist under the backup parent.")
    return folders[0]["id"] if folders else None


def ensure_folder(name: str, parent_id: str) -> str:
    existing = find_folder(name, parent_id)
    if existing:
        return existing
    response = drive_request(
        "POST", f"{DRIVE_API}/files",
        json={
            "name": name,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent_id],
        },
        params={"fields": "id,name"},
    ).json()
    return response["id"]


def list_drive_file(name: str, parent_id: str) -> list[dict]:
    query = (
        "trashed=false and "
        f"name='{q_escape(name)}' and '{q_escape(parent_id)}' in parents"
    )
    data = drive_request(
        "GET", f"{DRIVE_API}/files",
        params={"q": query, "pageSize": 100, "fields": "files(id,name,appProperties,size)"},
    ).json()
    return data.get("files", [])


def upload_bytes(name: str, parent_id: str, content: bytes, mime_type: str, digest: str) -> str:
    # Idempotent reruns: skip an existing same-name file only when its SHA-256 matches.
    matches = list_drive_file(name, parent_id)
    for item in matches:
        if (item.get("appProperties") or {}).get("sha256") == digest:
            return "already-present"

    final_name = name
    if matches:
        final_name = f"{name}.{digest[:12]}"
        if any((x.get("appProperties") or {}).get("sha256") == digest for x in matches):
            return "already-present"

    metadata = {
        "name": final_name,
        "parents": [parent_id],
        "appProperties": {"sha256": digest, "backup": "jfdrms-storage"},
    }
    headers = drive_headers()
    headers.update({
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mime_type or "application/octet-stream",
        "X-Upload-Content-Length": str(len(content)),
    })
    start = HTTP.post(
        f"{DRIVE_UPLOAD}?uploadType=resumable&fields=id,name,size",
        headers=headers, json=metadata, timeout=120,
    )
    start.raise_for_status()
    session_url = start.headers.get("Location")
    if not session_url:
        raise RuntimeError("Google Drive did not return a resumable upload session.")
    for offset in range(0, len(content), CHUNK_SIZE):
        chunk = content[offset:offset + CHUNK_SIZE]
        end = offset + len(chunk) - 1
        response = HTTP.put(
            session_url,
            headers={
                "Authorization": headers["Authorization"],
                "Content-Type": mime_type or "application/octet-stream",
                "Content-Length": str(len(chunk)),
                "Content-Range": f"bytes {offset}-{end}/{len(content)}",
            },
            data=chunk, timeout=300,
        )
        if response.status_code not in (200, 201, 308):
            response.raise_for_status()
        if response.status_code in (200, 201):
            break
    if response.status_code not in (200, 201):
        raise RuntimeError(f"Google Drive upload did not finalize (HTTP {response.status_code}).")
    return "uploaded"


def storage_headers() -> dict[str, str]:
    return {
        "apikey": required("SUPABASE_SERVICE_ROLE_KEY"),
        "Authorization": f"Bearer {required('SUPABASE_SERVICE_ROLE_KEY')}",
        "Content-Type": "application/json",
    }


def list_bucket_objects(base_url: str, bucket: str) -> list[dict]:
    """Walk Storage list prefixes recursively, collecting file objects only."""
    headers = storage_headers()
    found: list[dict] = []
    seen: set[str] = set()

    def walk(prefix: str) -> None:
        offset = 0
        while True:
            response = HTTP.post(
                f"{base_url}/storage/v1/object/list/{bucket}",
                headers=headers,
                json={
                    "prefix": prefix,
                    "limit": 1000,
                    "offset": offset,
                    "sortBy": {"column": "name", "order": "asc"},
                },
                timeout=120,
            )
            response.raise_for_status()
            rows = response.json()
            if not isinstance(rows, list):
                raise RuntimeError(f"Unexpected Storage listing response for bucket {bucket}.")
            for item in rows:
                name = str(item.get("name", ""))
                if not name:
                    continue
                full_path = f"{prefix}{name}" if prefix else name
                # Storage directory entries have no object id; recurse into them.
                if item.get("id") is None and item.get("metadata") is None:
                    if full_path not in seen:
                        seen.add(full_path)
                        walk(full_path.rstrip("/") + "/")
                else:
                    found.append({
                        "path": full_path,
                        "updated_at": item.get("updated_at") or item.get("created_at"),
                        "metadata": item.get("metadata") or {},
                    })
            if len(rows) < 1000:
                break
            offset += len(rows)

    walk("")
    # Defensive de-duplication in case a Storage listing returns a repeated page.
    unique = {item["path"]: item for item in found}
    return [unique[key] for key in sorted(unique)]


def download_object(base_url: str, bucket: str, path: str) -> bytes:
    from urllib.parse import quote
    encoded_path = "/".join(quote(part, safe="") for part in path.split("/"))
    response = HTTP.get(
        f"{base_url}/storage/v1/object/{bucket}/{encoded_path}",
        headers=storage_headers(), timeout=300, stream=True,
    )
    response.raise_for_status()
    return response.content


def drive_subfolder_path(root_id: str, relative_path: str) -> str:
    current = root_id
    parts = relative_path.split("/")[:-1]
    for part in parts:
        if part in ("", ".", ".."):
            raise RuntimeError("Unsafe object path returned by Storage.")
        current = ensure_folder(part, current)
    return current


def main() -> int:
    base_url = required("SUPABASE_URL").rstrip("/")
    parent_id = required("GOOGLE_DRIVE_BACKUP_FOLDER_ID")
    # Check the configured Drive destination before downloading any customer files.
    headers = drive_headers()
    parent = drive_request("GET", f"{DRIVE_API}/files/{parent_id}",
                           params={"fields": "id,name,mimeType,trashed"}).json()
    if parent.get("trashed") or parent.get("mimeType") != "application/vnd.google-apps.folder":
        raise RuntimeError("Configured Google Drive backup destination is not an active folder.")

    backup_date = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")
    manifest: list[dict] = []
    totals = {"objects": 0, "bytes": 0, "uploaded": 0, "already_present": 0}

    for bucket, drive_category in BUCKETS.items():
        category_id = find_folder(drive_category, parent_id)
        if not category_id:
            raise RuntimeError(f"Expected existing Drive subfolder {drive_category!r} was not found.")
        date_id = ensure_folder(backup_date, category_id)
        objects = list_bucket_objects(base_url, bucket)
        print(f"Discovered {len(objects)} object(s) in bucket {bucket}.")
        for item in objects:
            path = item["path"]
            data = download_object(base_url, bucket, path)
            digest = hashlib.sha256(data).hexdigest()
            destination_id = drive_subfolder_path(date_id, path)
            name = path.split("/")[-1]
            result = upload_bytes(name, destination_id, data,
                                  (item.get("metadata") or {}).get("mimetype", "application/octet-stream"),
                                  digest)
            manifest.append({
                "bucket": bucket,
                "object_path": path,
                "bytes": len(data),
                "sha256": digest,
                "updated_at": item.get("updated_at"),
                "drive_status": result,
            })
            totals["objects"] += 1
            totals["bytes"] += len(data)
            totals["uploaded"] += result == "uploaded"
            totals["already_present"] += result == "already-present"

    manifest_bytes = json.dumps({
        "backup_date": backup_date,
        "project": "JFDRMS production",
        "buckets": list(BUCKETS),
        "totals": totals,
        "objects": manifest,
    }, indent=2, sort_keys=True).encode("utf-8")
    manifest_hash = hashlib.sha256(manifest_bytes).hexdigest()
    manifest_id = ensure_folder("Manifests", parent_id)
    upload_bytes(f"jfdrms-storage-manifest-{backup_date}.json", manifest_id,
                 manifest_bytes, "application/json", manifest_hash)

    print(json.dumps({"backup_date": backup_date, **totals}, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        # Do not print exception bodies from HTTP responses; they may contain sensitive data.
        print(f"Storage backup failed: {type(exc).__name__}: {str(exc)[:240]}", file=sys.stderr)
        raise SystemExit(1)
