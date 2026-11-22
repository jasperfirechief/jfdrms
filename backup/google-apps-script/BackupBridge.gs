/**
 * JFD RMS encrypted backup receiver.
 *
 * Deploy as a Web App:
 *   Execute as: Me
 *   Who has access: Anyone (the HMAC signature is the access control)
 *
 * Set Script Properties before deployment:
 *   JFD_BACKUP_FOLDER_ID       Drive folder ID for this account's Database Backups folder
 *   JFD_BACKUP_HMAC_SECRET     Unique random secret, at least 32 characters
 *
 * Never log the request body, HMAC secret, or decoded backup bytes.
 */
function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('JFD_BACKUP_HMAC_SECRET');
    const folderId = props.getProperty('JFD_BACKUP_FOLDER_ID');
    if (!secret || secret.length < 32 || !folderId) {
      throw new Error('Bridge is not configured');
    }

    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 45 * 1024 * 1024) {
      throw new Error('Invalid request size');
    }
    const request = JSON.parse(raw);
    const timestamp = String(request.timestamp || '');
    const filename = String(request.filename || '');
    const sha256 = String(request.sha256 || '').toLowerCase();
    const signature = String(request.signature || '').toLowerCase();
    const encoded = String(request.data || '');

    if (!/^\\d{10}$/.test(timestamp) ||
        Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300 ||
        !/^jfdrms-db-\\d{4}-\\d{2}-\\d{2}T\\d{6}Z\\.dump\\.age$/.test(filename) ||
        !/^[a-f0-9]{64}$/.test(sha256) ||
        !/^[a-f0-9]{64}$/.test(signature) ||
        !encoded) {
      throw new Error('Invalid request');
    }

    const message = timestamp + '\\n' + filename + '\\n' + sha256;
    const expected = toHex_(Utilities.computeHmacSha256Signature(message, secret));
    if (!constantTimeEqual_(expected, signature)) {
      throw new Error('Invalid signature');
    }

    const bytes = Utilities.base64Decode(encoded);
    if (!bytes.length || bytes.length > 32 * 1024 * 1024) {
      throw new Error('Invalid backup size');
    }
    const actualHash = toHex_(Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256, bytes
    ));
    if (actualHash !== sha256) {
      throw new Error('Checksum mismatch');
    }

    // Make retries idempotent if Drive accepted the file but the response was lost.
    if (props.getProperty('JFD_LAST_BACKUP_SIGNATURE') === signature) {
      const previousId = props.getProperty('JFD_LAST_BACKUP_FILE_ID');
      if (previousId) {
        try {
          const previous = DriveApp.getFileById(previousId);
          return json_({ ok: true, duplicate: true, fileId: previous.getId(),
                         name: previous.getName(), size: previous.getSize() });
        } catch (_) {}
      }
    }

    const folder = DriveApp.getFolderById(folderId);
    const blob = Utilities.newBlob(bytes, 'application/octet-stream', filename);
    const file = folder.createFile(blob);
    props.setProperty('JFD_LAST_BACKUP_SIGNATURE', signature);
    props.setProperty('JFD_LAST_BACKUP_FILE_ID', file.getId());

    return json_({ ok: true, fileId: file.getId(), name: file.getName(),
                   size: file.getSize() });
  } catch (err) {
    // Do not return internal details or secrets to the caller.
    return json_({ ok: false, error: 'Backup upload rejected. Check Apps Script execution log.' });
  }
}

function doGet() {
  return json_({ ok: true, service: 'JFD RMS backup receiver', method: 'POST required' });
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function toHex_(bytes) {
  return bytes.map(function (b) {
    const value = (b + 256) % 256;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function constantTimeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
