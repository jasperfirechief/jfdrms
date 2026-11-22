#!/usr/bin/env python3
"""Upload one encrypted JFDRMS backup to an authenticated Apps Script bridge."""
import argparse
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone

MAX_FILE_BYTES = 32 * 1024 * 1024


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True)
    parser.add_argument("--url", required=True)
    parser.add_argument("--secret-env", required=True)
    args = parser.parse_args()

    secret = os.environ.get(args.secret_env, "")
    if len(secret) < 32:
        raise SystemExit(f"Required environment secret {args.secret_env} is missing or too short.")
    if not args.url.startswith("https://script.google.com/macros/s/") or not args.url.endswith("/exec"):
        raise SystemExit("Bridge URL must be a Google Apps Script /exec HTTPS URL.")

    with open(args.file, "rb") as source:
        payload_bytes = source.read(MAX_FILE_BYTES + 1)
    if not payload_bytes or len(payload_bytes) > MAX_FILE_BYTES:
        raise SystemExit("Encrypted backup must be between 1 byte and 32 MiB.")

    filename = "jfdrms-db-" + datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ") + ".dump.gpg"
    timestamp = str(int(time.time()))
    digest = hashlib.sha256(payload_bytes).hexdigest()
    message = f"{timestamp}\n{filename}\n{digest}".encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
    request_body = json.dumps({
        "timestamp": timestamp, "filename": filename, "sha256": digest,
        "signature": signature,
        "data": base64.b64encode(payload_bytes).decode("ascii"),
    }, separators=(",", ":")).encode("utf-8")

    request = urllib.request.Request(args.url, data=request_body,
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=300) as response:
        result = json.loads(response.read().decode("utf-8"))

    if result.get("ok") is not True:
        code = result.get("code", "UNSPECIFIED_REJECTION")
        safe_codes = {"CONFIG","REQUEST_INVALID","JSON_INVALID","AUTH_FAILED",
            "BASE64_INVALID","PAYLOAD_SIZE","CHECKSUM_MISMATCH","REQUEST_ERROR",
            "AUTH_ERROR","PAYLOAD_ERROR","DRIVE_ERROR","SAVE_RECEIPT_ERROR"}
        if code not in safe_codes:
            code = "UNRECOGNIZED_REJECTION"
        raise SystemExit(f"Google Drive bridge rejected the backup (code: {code}).")
    print(json.dumps({"uploaded": True, "filename": result.get("name", filename),
        "bytes": result.get("size", len(payload_bytes)),
        "duplicate": bool(result.get("duplicate", False))}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Backup upload failed: {type(exc).__name__}", file=sys.stderr)
        raise SystemExit(1)
