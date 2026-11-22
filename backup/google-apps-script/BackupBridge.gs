/**
 * JFD RMS encrypted backup receiver.
 * Web App: Execute as Me; access Anyone (HMAC is the access control).
 * Script Properties: JFD_BACKUP_FOLDER_ID, JFD_BACKUP_HMAC_SECRET.
 * Never log request bodies, secrets, or decoded backup bytes.
 */
function doPost(e) {
  let stage = 'CONFIG';
  try {
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('JFD_BACKUP_HMAC_SECRET');
    const folderId = props.getProperty('JFD_BACKUP_FOLDER_ID');
    if (!secret || secret.length < 32 || !folderId) throw new Error('CONFIG');

    stage = 'REQUEST';
    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 45 * 1024 * 1024) throw new Error('REQUEST_INVALID');
    let request;
    try { request = JSON.parse(raw); } catch (_) { throw new Error('JSON_INVALID'); }

    const timestamp = String(request.timestamp || '');
    const filename = String(request.filename || '');
    const sha256 = String(request.sha256 || '').toLowerCase();
    const signature = String(request.signature || '').toLowerCase();
    const encoded = String(request.data || '');

    if (!/^\\d{10}$/.test(timestamp) ||
        Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300 ||
        !/^jfdrms-db-\\d{4}-\\d{2}-\\d{2}T\\d{6}Z\\.dump\\.gpg$/.test(filename) ||
        !/^[a-f0-9]{64}$/.test(sha256) ||
        !/^[a-f0-9]{64}$/.test(signature) || !encoded) {
      throw new Error('REQUEST_INVALID');
    }

    stage = 'AUTH';
    const message = timestamp + '\\n' + filename + '\\n' + sha256;
    const expected = toHex_(Utilities.computeHmacSha256Signature(message, secret));
    if (!constantTimeEqual_(expected, signature)) throw new Error('AUTH_FAILED');

    stage = 'PAYLOAD';
    let bytes;
    try { bytes = Utilities.base64Decode(encoded); } catch (_) { throw new Error('BASE64_INVALID'); }
    if (!bytes.length || bytes.length > 32 * 1024 * 1024) throw new Error('PAYLOAD_SIZE');
    const actualHash = toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));
    if (actualHash !== sha256) throw new Error('CHECKSUM_MISMATCH');

    stage = 'DRIVE';
    if (props.getProperty('JFD_LAST_BACKUP_SIGNATURE') === signature) {
      const previousId = props.getProperty('JFD_LAST_BACKUP_FILE_ID');
      if (previousId) {
        try {
          const previous = DriveApp.getFileById(previousId);
          return json_({ok:true, duplicate:true, name:previous.getName(), size:previous.getSize()});
        } catch (_) {}
      }
    }
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(Utilities.newBlob(bytes, 'application/octet-stream', filename));

    stage = 'SAVE_RECEIPT';
    props.setProperty('JFD_LAST_BACKUP_SIGNATURE', signature);
    props.setProperty('JFD_LAST_BACKUP_FILE_ID', file.getId());
    return json_({ok:true, name:file.getName(), size:file.getSize()});
  } catch (err) {
    const allowed = ['CONFIG','REQUEST_INVALID','JSON_INVALID','AUTH_FAILED',
      'BASE64_INVALID','PAYLOAD_SIZE','CHECKSUM_MISMATCH'];
    const code = err && allowed.indexOf(err.message) >= 0 ? err.message : stage + '_ERROR';
    console.error('JFD backup bridge rejection code: ' + code);
    return json_({ok:false, code:code, error:'Backup upload rejected. No secret or backup data is included.'});
  }
}

/**
 * Authenticated download of one encrypted archive from the configured folder.
 * HMAC message: timestamp + newline + filename + newline + DOWNLOAD.
 * Returns base64 ciphertext only; plaintext is never served by this endpoint.
 */
function doGet(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('JFD_BACKUP_HMAC_SECRET');
    const folderId = props.getProperty('JFD_BACKUP_FOLDER_ID');
    if (!secret || secret.length < 32 || !folderId) throw new Error('CONFIG');

    const params = e && e.parameter ? e.parameter : {};
    const timestamp = String(params.timestamp || '');
    const filename = String(params.filename || '');
    const signature = String(params.signature || '').toLowerCase();

    if (params.action !== 'download' ||
        !/^\\d{10}$/.test(timestamp) ||
        Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300 ||
        !/^jfdrms-db-\\d{4}-\\d{2}-\\d{2}T\\d{6}Z\\.dump\\.gpg$/.test(filename) ||
        !/^[a-f0-9]{64}$/.test(signature)) {
      throw new Error('REQUEST_INVALID');
    }

    const message = timestamp + '\\n' + filename + '\\nDOWNLOAD';
    const expected = toHex_(Utilities.computeHmacSha256Signature(message, secret));
    if (!constantTimeEqual_(expected, signature)) throw new Error('AUTH_FAILED');

    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByName(filename);
    if (!files.hasNext()) throw new Error('NOT_FOUND');
    const file = files.next();
    if (files.hasNext()) throw new Error('AMBIGUOUS_FILE');
    const blob = file.getBlob();
    const bytes = blob.getBytes();
    if (!bytes.length || bytes.length > 32 * 1024 * 1024) throw new Error('PAYLOAD_SIZE');
    const digest = toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));
    return json_({ok:true, filename:filename, bytes:bytes.length, sha256:digest,
      data:Utilities.base64Encode(bytes)});
  } catch (err) {
    const allowed = ['CONFIG','REQUEST_INVALID','AUTH_FAILED','NOT_FOUND',
      'AMBIGUOUS_FILE','PAYLOAD_SIZE'];
    const code = err && allowed.indexOf(err.message) >= 0 ? err.message : 'DOWNLOAD_ERROR';
    console.error('JFD backup download rejection code: ' + code);
    return json_({ok:false, code:code, error:'Encrypted backup download rejected.'});
  }
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
function toHex_(bytes) {
  return bytes.map(function(b) {
    const value = (b + 256) % 256;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}
function constantTimeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
