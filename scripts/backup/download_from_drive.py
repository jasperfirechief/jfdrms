#!/usr/bin/env python3
"""Download one named encrypted JFDRMS backup from an authenticated Drive bridge."""
import argparse
import base64
import hashlib
import hmac
import json
import os
import re
import sys
import time
import urllib.request


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--secret-env", required=True)
    parser.add_argument("--filename", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    secret = os.environ.get(args.secret_env, "")
    if len(secret) < 32:
        raise SystemExit(f"Required environment secret {args.secret_env} is missing or too short.")
    if not args.url.startswith("https://script.google.com/macros/s/") or not args.url.endswith("/exec"):
        raise SystemExit("Bridge URL must be a Google Apps Script /exec HTTPS URL.")
    if not re.fullmatch(r"jfdrms-db-\d{4}-\d{2}-\d{2}T\d{6}Z\.dump\.gpg", args.filename):
        raise SystemExit("A specific valid JFDRMS backup filename is required.")

    timestamp = str(int(time.time()))
    message = f"download\n{timestamp}\n{args.filename}".encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
    body = json.dumps({
        "action": "download", "timestamp": timestamp,
        "filename": args.filename, "signature": signature,
    }, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        args.url, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        result = json.loads(response.read().decode("utf-8"))
    if result.get("ok") is not True or result.get("filename") != args.filename:
        raise SystemExit("Drive bridge did not return the requested backup.")
    payload = base64.b64decode(result.get("data", ""), validate=True)
    if not payload or len(payload) > 32 * 1024 * 1024:
        raise SystemExit("Downloaded backup has an invalid size.")
    digest = hashlib.sha256(payload).hexdigest()
    if not hmac.compare_digest(digest, str(result.get("sha256", "")).lower()):
        raise SystemExit("Downloaded backup checksum verification failed.")
    with open(args.output, "xb") as target:
        target.write(payload)
    print(json.dumps({"downloaded": True, "filename": args.filename, "bytes": len(payload),
                      "sha256_verified": True}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Backup download failed: {type(exc).__name__}", file=sys.stderr)
        raise SystemExit(1)
