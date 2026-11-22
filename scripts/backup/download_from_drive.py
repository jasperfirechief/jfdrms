#!/usr/bin/env python3
"""Fetch one encrypted JFDRMS archive from the authenticated Apps Script bridge."""
import argparse
import base64
import hashlib
import hmac
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

MAX_FILE_BYTES = 32 * 1024 * 1024
FILENAME_RE = re.compile(r"^jfdrms-db-\d{4}-\d{2}-\d{2}T\d{6}Z\.dump\.gpg$")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--filename", required=True)
    parser.add_argument("--url", required=True)
    parser.add_argument("--secret-env", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    if not FILENAME_RE.fullmatch(args.filename):
        raise SystemExit("Backup filename format is invalid.")
    secret = os.environ.get(args.secret_env, "")
    if len(secret) < 32:
        raise SystemExit(f"Required environment secret {args.secret_env} is missing or too short.")
    if not args.url.startswith("https://script.google.com/macros/s/") or not args.url.endswith("/exec"):
        raise SystemExit("Bridge URL must be a Google Apps Script /exec HTTPS URL.")

    timestamp = str(int(time.time()))
    message = f"{timestamp}\n{args.filename}\nDOWNLOAD".encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
    query = urllib.parse.urlencode({
        "action": "download", "timestamp": timestamp,
        "filename": args.filename, "signature": signature,
    })
    request = urllib.request.Request(args.url + "?" + query, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=300) as response:
        result = json.loads(response.read().decode("utf-8"))

    if result.get("ok") is not True:
        code = result.get("code", "UNSPECIFIED_REJECTION")
        safe_codes = {"CONFIG", "REQUEST_INVALID", "AUTH_FAILED", "NOT_FOUND",
                      "AMBIGUOUS_FILE", "PAYLOAD_SIZE", "DOWNLOAD_ERROR"}
        if code not in safe_codes:
            code = "UNRECOGNIZED_REJECTION"
        raise SystemExit(f"Google Drive bridge rejected the download (code: {code}).")

    if result.get("filename") != args.filename:
        raise SystemExit("Downloaded filename did not match the requested archive.")
    try:
        payload = base64.b64decode(result.get("data", ""), validate=True)
    except Exception:
        raise SystemExit("Downloaded archive data was not valid base64.")
    if not payload or len(payload) > MAX_FILE_BYTES or result.get("bytes") != len(payload):
        raise SystemExit("Downloaded archive size validation failed.")
    digest = hashlib.sha256(payload).hexdigest()
    if not hmac.compare_digest(digest, str(result.get("sha256", ""))):
        raise SystemExit("Downloaded archive SHA-256 validation failed.")

    with open(args.output, "xb") as output:
        output.write(payload)
    print(json.dumps({"downloaded": True, "filename": args.filename,
                      "bytes": len(payload), "sha256_verified": True}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Encrypted backup download failed: {type(exc).__name__}", file=sys.stderr)
        raise SystemExit(1)
