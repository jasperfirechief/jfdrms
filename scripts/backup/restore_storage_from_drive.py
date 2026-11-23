#!/usr/bin/env python3
"""Restore missing JFDRMS Storage objects from a dated Google Drive backup."""
from __future__ import annotations
import hashlib, json, mimetypes, os, re, sys
from urllib.parse import quote, urlparse
import requests
from backup_storage_to_drive import (
    BUCKET_FOLDER_MAP, DEFAULT_BUCKET_FOLDER, DRIVE_API, EXPECTED_PRODUCTION_PROJECT_REF,
    drive_request, find_folder, list_drive_file, required, storage_headers,
)
HTTP = requests.Session()

def enc(path):
    parts = path.split("/")
    if not path or any(p in ("", ".", "..") for p in parts):
        raise RuntimeError("Unsafe object path in backup manifest.")
    return "/".join(quote(p, safe="") for p in parts)

def drive_bytes(file_id):
    return drive_request("GET", f"{DRIVE_API}/files/{file_id}", params={"alt":"media"}).content

def find_object(root, date, bucket, path, digest):
    category = BUCKET_FOLDER_MAP.get(bucket, DEFAULT_BUCKET_FOLDER)
    category_id = find_folder(category, root)
    date_id = find_folder(date, category_id) if category_id else None
    bucket_id = find_folder(bucket, date_id) if date_id else None
    if not bucket_id:
        raise RuntimeError(f"Backup folder path missing for {bucket}/{path}.")
    parts = path.split("/")
    if any(p in ("", ".", "..") for p in parts):
        raise RuntimeError("Unsafe object path in backup manifest.")
    parent = bucket_id
    for part in parts[:-1]:
        parent = find_folder(part, parent)
        if not parent:
            raise RuntimeError(f"Backup subfolder missing for {bucket}/{path}.")
    matches = list_drive_file(parts[-1], parent)
    matches += list_drive_file(parts[-1] + "." + digest[:12], parent)
    found = [x for x in matches if (x.get("appProperties") or {}).get("sha256") == digest]
    if len(found) != 1:
        raise RuntimeError(f"Expected one checksum-matching Drive object for {bucket}/{path}; found {len(found)}.")
    return found[0]["id"]

def object_exists(base, bucket, path):
    # Use Storage's metadata endpoint for an existence check. HEAD on the
    # object-download endpoint can return a generic 400 for missing objects.
    url = f"{base}/storage/v1/object/info/{bucket}/{enc(path)}"
    r = HTTP.get(url, headers=storage_headers(), timeout=120)
    if r.status_code == 404:
        return False
    if not r.ok:
        detail = (r.text or "")[:1000]
        raise RuntimeError(f"Supabase Storage existence check failed ({r.status_code}): {detail}")
    return True

def restore_object(base, bucket, path, data, mime):
    h = storage_headers()
    h.update({"Content-Type": mime or "application/octet-stream", "x-upsert":"false"})
    url = f"{base}/storage/v1/object/{bucket}/{enc(path)}"
    r = HTTP.post(url, headers=h, data=data, timeout=300)
    if not r.ok:
        # Include Supabase's response detail in Actions logs; HTTPError alone
        # hides the actionable Storage API error message.
        detail = (r.text or "")[:1000]
        raise RuntimeError(f"Supabase Storage upload rejected ({r.status_code}): {detail}")
    check = HTTP.get(url, headers=storage_headers(), timeout=300)
    if not check.ok:
        detail = (check.text or "")[:1000]
        raise RuntimeError(f"Supabase Storage read-back failed ({check.status_code}): {detail}")
    return hashlib.sha256(check.content).hexdigest()

def main():
    base = required("JASPER_FD_SUPABASE_URL").rstrip("/")
    p = urlparse(base)
    if p.scheme != "https" or p.hostname != EXPECTED_PRODUCTION_PROJECT_REF + ".supabase.co":
        raise RuntimeError("Refusing restore: URL is not verified Jasper FD production.")
    date = required("RESTORE_BACKUP_DATE")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        raise RuntimeError("Backup date must be YYYY-MM-DD.")
    bucket_filter = os.environ.get("RESTORE_BUCKET", "").strip()
    root = required("GOOGLE_DRIVE_BACKUP_FOLDER_ID")
    folder = drive_request("GET", f"{DRIVE_API}/files/{root}", params={"fields":"id,mimeType,trashed"}).json()
    if folder.get("trashed") or folder.get("mimeType") != "application/vnd.google-apps.folder":
        raise RuntimeError("Configured Drive backup destination is not an active folder.")
    manifests = find_folder("Manifests", root)
    if not manifests:
        raise RuntimeError("Drive Manifests folder not found.")
    # A prior empty manifest may already occupy the canonical filename. The
    # backup uploader safely suffixes a changed-content file with its digest;
    # inspect all canonical and digest-suffixed versions and select the newest
    # valid manifest for this project/date with the greatest object count.
    canonical = f"jfdrms-storage-manifest-{date}.json"
    query = (
        "trashed=false and "
        f"name contains '{canonical}' and '{manifests}' in parents"
    )
    response = drive_request(
        "GET", f"{DRIVE_API}/files",
        params={"q": query, "pageSize": 100, "fields": "files(id,name,appProperties,modifiedTime)"},
    ).json()
    candidates = response.get("files", [])
    valid_manifests = []
    seen_ids = set()
    for candidate in candidates:
        if candidate["id"] in seen_ids:
            continue
        seen_ids.add(candidate["id"])
        raw_candidate = drive_bytes(candidate["id"])
        if (candidate.get("appProperties") or {}).get("sha256") != hashlib.sha256(raw_candidate).hexdigest():
            continue
        try:
            parsed = json.loads(raw_candidate)
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
        if parsed.get("project") == "Jasper FD production" and parsed.get("backup_date") == date and isinstance(parsed.get("objects"), list):
            valid_manifests.append((len(parsed["objects"]), candidate.get("modifiedTime", ""), parsed))
    if not valid_manifests:
        raise RuntimeError(f"No checksum-valid Jasper FD production manifest found for {date}.")
    valid_manifests.sort(key=lambda entry: (entry[0], entry[1]), reverse=True)
    manifest = valid_manifests[0][2]
    objects = manifest.get("objects")
    if not isinstance(objects, list):
        raise RuntimeError("Manifest object list is invalid.")
    selected = [x for x in objects if not bucket_filter or x.get("bucket") == bucket_filter]
    if bucket_filter and not selected:
        raise RuntimeError(f"Bucket {bucket_filter!r} is not in this manifest.")
    restored = skipped = total = 0
    for item in selected:
        bucket, path, digest = str(item.get("bucket") or ""), str(item.get("object_path") or ""), str(item.get("sha256") or "")
        if not bucket or not path or not re.fullmatch(r"[a-f0-9]{64}", digest):
            raise RuntimeError("Manifest contains an invalid object entry.")
        if object_exists(base, bucket, path):
            print(f"Already exists; left unchanged: {bucket}/{path}")
            skipped += 1
            continue
        file_id = find_object(root, date, bucket, path, digest)
        data = drive_bytes(file_id)
        if hashlib.sha256(data).hexdigest() != digest:
            raise RuntimeError(f"Drive file checksum failed: {bucket}/{path}")
        mime = (item.get("metadata") or {}).get("mimetype") or mimetypes.guess_type(path)[0] or "application/octet-stream"
        actual = restore_object(base, bucket, path, data, mime)
        if actual != digest:
            raise RuntimeError(f"Restored file checksum failed: {bucket}/{path}")
        print(f"Restored and verified: {bucket}/{path} ({len(data)} bytes)")
        restored += 1
        total += len(data)
    print(json.dumps({"backup_date":date,"bucket_filter":bucket_filter or "all","manifest_objects_selected":len(selected),"restored_and_verified":restored,"skipped_existing_unchanged":skipped,"bytes_restored":total}, sort_keys=True))

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Storage restore failed: {type(exc).__name__}: {str(exc)[:240]}", file=sys.stderr)
        raise SystemExit(1)
