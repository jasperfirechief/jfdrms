# JFDRMS encrypted database backup

The backup workflow runs from the repository's default branch. It is separate from the live Vercel application and does not deploy or modify the RMS.

## What this first stage backs up

- A full PostgreSQL custom-format dump of the JFDRMS Supabase database, including database schemas and records that the database connection is permitted to read.
- The dump is encrypted on the temporary GitHub runner with AES-256 using GPG before it is sent anywhere.
- The encrypted file is copied to the `Database Backups` folder in the first and second managed Google Drive accounts.
- The workflow checks that PostgreSQL can read the archive before encryption and upload.

The current database is PostgreSQL 17.6; the workflow uses a PostgreSQL 17 client.

## Important limits — not yet a complete disaster-recovery system

- This database stage does **not** copy the actual bytes of files stored in Supabase Storage. A database dump can include Storage metadata, but it does not include the objects themselves. Preplan photos and inspection attachments need a separate file-backup stage to Account 3.
- The workflow is scheduled daily at 2:00 AM Central (`America/Chicago`) and can also be started manually with `workflow_dispatch`.
- The Apps Script receiver source now includes rolling retention: one backup per day for the latest 30 distinct backup dates, plus one latest backup per month for the latest 12 distinct months. Expired matching backup files are moved to Drive Trash, not permanently deleted.
- The retention change is not active in either Drive account until the updated `BackupBridge.gs` is copied into both Apps Script projects and each web-app deployment is updated to a new version.
- A recent encrypted backup was restored successfully into an isolated Supabase project. This verifies the database backup/restore path, but does not back up Supabase Storage file bytes or provide full Supabase Auth/Realtime/Edge Function failover.

## 1. Configure the Apps Script receiver in Drive Account 1

Use the existing project `JFD RMS Backup Bridge`.

1. Open the project at [Google Apps Script](https://script.google.com/home).
2. Add a new script file named `BackupBridge` and paste the complete contents of `backup/google-apps-script/BackupBridge.gs` from this repository branch.
3. In Google Drive, open `JFD RMS BACKUPS / Database Backups`. Copy the folder ID from the address bar URL after `/folders/`.
4. In Apps Script, open **Project Settings** (gear) → **Script properties** → **Add script property**.
5. Add `JFD_BACKUP_FOLDER_ID` with that folder ID.
6. Add `JFD_BACKUP_HMAC_SECRET` with a newly generated random secret of at least 32 characters. Use a different secret for each Drive account. Do not send either secret in ChatGPT or put it in source code.
7. Select **Deploy** → **New deployment** → **Web app**. Set **Execute as** to **Me**. The caller must be able to reach the endpoint without signing into Workspace; choose **Anyone** only if your Workspace administrator permits it. The HMAC signature is the endpoint's application-level authentication.
8. Authorize the script and copy the Web app URL ending in `/exec`.

If Workspace does not offer or permit **Anyone**, stop here. Do not loosen a Workspace security policy or choose a weaker access setting.

## 2. Configure the Apps Script receiver in Drive Account 2

Repeat the same steps in the existing project `JFD RMS Backup Bridge 2`, but use Account 2's `JFD RMS BACKUPS / Database Backups` folder and generate a different random HMAC secret. Copy that deployment's `/exec` URL.

Account 3 is reserved for the later Storage-object backup stage and is not used by this database workflow.

## 3. Add GitHub Actions secrets

In the repository, open **Settings** → **Secrets and variables** → **Actions**. Add these as **Repository secrets** (not files, not plain repository variables):

| Secret name | Value |
|---|---|
| `SUPABASE_DB_URL` | PostgreSQL **Session pooler** connection string from Supabase Project Settings → Database. It must contain the database password. Do not use the transaction pooler for `pg_dump`. |
| `BACKUP_ENCRYPTION_PASSPHRASE` | A unique, randomly generated passphrase of at least 32 characters. Keep a separate offline copy in an approved secure location. If lost, the encrypted backups cannot be decrypted. |
| `DRIVE_BRIDGE_URL_PRIMARY` | Account 1 Apps Script Web app `/exec` URL |
| `DRIVE_BRIDGE_HMAC_SECRET_PRIMARY` | The exact HMAC secret entered in Account 1's Script Properties |
| `DRIVE_BRIDGE_URL_SECONDARY` | Account 2 Apps Script Web app `/exec` URL |
| `DRIVE_BRIDGE_HMAC_SECRET_SECONDARY` | The exact HMAC secret entered in Account 2's Script Properties |

Never paste the database connection string or any of these secrets into this chat, a GitHub file, an issue, or a workflow log. Do not reset the Supabase database password just for this setup; if the existing password is unavailable, pause and decide on a credential rotation separately.

## 4. Run a manual backup test

The workflow can still be started manually from **Actions → JFDRMS Encrypted Database Backup → Run workflow** on the default branch. Confirm both Drive uploads succeed in the run logs. The daily schedule is already enabled for 2:00 AM Central.

## Security notes

- The GitHub repository is public. No database URL, password, HMAC secret, encryption passphrase, backup file, or other credential may be committed to it.
- The database archive is encrypted before upload. The HMAC signature authenticates each upload request and expires after five minutes.
- The Apps Script receiver accepts only encrypted backup filenames, validates the HMAC and SHA-256 checksum, limits the decoded file to 32 MiB, and does not log the request body.
- The workflow uses no GitHub artifact storage for database contents.
- GitHub-hosted runners are temporary. The workflow deletes its local working backup files at the end of the job.


## 5. Enable rolling retention in both Google Drive backup accounts

The updated `backup/google-apps-script/BackupBridge.gs` adds conservative rolling retention inside each configured `Database Backups` folder:

- Keep the latest 30 distinct backup dates (one file per date).
- Also keep the latest backup from each of the latest 12 distinct months.
- Move only older files whose names match the JFDRMS encrypted-backup filename to Google Drive Trash. Nothing is permanently deleted.
- Retention runs only after a new encrypted backup has been successfully created and its receipt saved. Cleanup errors do not invalidate the new backup.

To activate it, open both existing Apps Script projects (`JFD RMS Backup Bridge` and `JFD RMS Backup Bridge 2`), replace the contents of `BackupBridge.gs` with the updated repository version, then select **Deploy → Manage deployments → Edit** for the existing web app deployment and choose **New version → Deploy**. Keep the existing script properties and web-app URLs unchanged. Repeat for the second account. Do not create new script properties or rotate the HMAC secrets for this code-only update.

This retention applies only to matching backup files in the two configured `Database Backups` folders. It does not delete or reorganize other Drive folders.
