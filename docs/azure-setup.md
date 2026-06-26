# Azure / Microsoft Entra ID setup

chocolate.lottery gates the whole app behind **Microsoft Entra ID** sign-in and
uses the signed-in profile as the player identity. This is a one-time setup in
the Entra admin center.

## 1. Register the application

1. Go to the [Microsoft Entra admin center](https://entra.microsoft.com) →
   **Identity → Applications → App registrations → New registration**.
2. **Name:** `chocolate.lottery`
3. **Supported account types:** *Accounts in this organizational directory only*
   (single tenant — only your colleagues can sign in).
4. **Redirect URI:** platform **Web**, value:
   `http://localhost:4321/api/auth/callback` (for local dev).
5. Click **Register**.

## 2. Copy the IDs

On the app's **Overview** page, copy:

- **Application (client) ID** → `AZURE_CLIENT_ID`
- **Directory (tenant) ID** → `AZURE_TENANT_ID`

## 3. Create a client secret

1. **Certificates & secrets → Client secrets → New client secret**.
2. Add a description and expiry, click **Add**.
3. Copy the secret **Value** immediately (it's only shown once) → `AZURE_CLIENT_SECRET`.

## 4. API permissions

Under **API permissions**, ensure Microsoft Graph **delegated** permissions
include `openid`, `profile`, and `email` (these are usually present by default).
`User.Read` is optional. Grant admin consent if your tenant requires it.

## 5. Configure the app

Copy `.env.example` to `.env` and fill in the four Azure values plus a random
`SESSION_SECRET`:

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # -> SESSION_SECRET
```

Then run `npm run dev` and open http://localhost:4321 — you'll be redirected to
sign in with Microsoft.

## 6. Production redirect URI

When you deploy (e.g. Railway), add a second redirect URI on the app
registration for the public domain and set the env vars on the host:

- Redirect URI: `https://<your-domain>/api/auth/callback`
- `AZURE_REDIRECT_URI=https://<your-domain>/api/auth/callback`

> The cookie `Secure` flag is enabled automatically whenever `AZURE_REDIRECT_URI`
> uses `https`, so production sessions are sent only over TLS.
