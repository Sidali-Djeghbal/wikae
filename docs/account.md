# Wikae account and Sync

The account is optional and free. Wikae works fully offline without one. An account is only used for Wikae Sync (end-to-end encrypted sync between devices).

The app talks to a sync server. The default is `https://sync.etude.study`. Change it in Settings → Account → Server, with `etude account server <url>`, or with `$ETUDE_CLOUD_URL` (the saved choice wins). The account token lives in `<ETUDE_HOME>/account.json` (mode 600) and never reaches the web page; the UI goes through `/api/account/*` on the local server, which forwards to the cloud.

## Settings → Account

- Sign in with a one-time code from the email, or with a passkey (WebAuthn in the browser; the server's RP id must match the page's host).
- Email, change email (a link goes to the new address; needs a sign-in in the last 10 minutes).
- Passkeys: add, remove.
- Devices: list, rename, revoke. Revoking another device needs a fresh sign-in.
- Export my data: the server's JSON export.
- Delete account: type the email to confirm, then confirm a fresh sign-in if the last one is older than 10 minutes. The server deletes devices, passkeys and the Sync vault. The local collection stays.

The Sync status and storage meter are in Settings → Sync while signed in to the account (not for folder sync).

Signing in to the account also signs Sync in when Sync uses the same server, so Sync only needs the vault password afterwards.
