# HailScout Auth Setup (Google + Microsoft, no Clerk)

HailScout now runs its **own** authentication — no Clerk, no per-user fees. Flow:

```
Browser → "Continue with Google/Microsoft"
  → web (Arctic) runs the OAuth code-exchange  → gets provider id_token
  → POST /v1/auth/exchange (API verifies id_token, matches user BY EMAIL,
     mints our own access + refresh tokens)
  → web stores them in httpOnly cookies; browser calls the API with a short
     access token (fetched from /api/auth/token), refresh token never leaves
     the server.
```

The **API is the identity authority**: it verifies the Google/Microsoft token and
issues our session tokens. Client *secrets* live only in the **web** tier; the
API only needs the public client IDs (to validate token audience).

> **Account model:** we do **not** auto-provision strangers. A user can only sign
> in if an account with their email already exists (seeded, or created by a
> super-admin under Tenant management). First sign-in links their Google/MS
> identity to that row — same behavior as the old Clerk webhook.

---

## 1. Google Cloud — OAuth client

1. <https://console.cloud.google.com> → APIs & Services → **OAuth consent screen**.
   - User type **External**. Add scopes `openid`, `email`, `profile`.
   - While testing, add your sign-in emails under **Test users** (or **Publish**).
2. **Credentials → Create credentials → OAuth client ID → Web application.**
   - **Authorized redirect URIs** (add all you use):
     - `https://hailscout.net/api/auth/google/callback`
     - `http://localhost:3000/api/auth/google/callback`  *(local dev)*
   - Copy the **Client ID** and **Client secret**.

## 2. Microsoft Entra (Azure) — app registration

1. <https://portal.azure.com> → **Microsoft Entra ID → App registrations → New registration**.
   - **Supported account types:** "Accounts in any organizational directory and
     personal Microsoft accounts" → keeps `MICROSOFT_OAUTH_TENANT=common`.
   - **Redirect URI** (platform = Web):
     - `https://hailscout.net/api/auth/microsoft/callback`
     - `http://localhost:3000/api/auth/microsoft/callback`  *(add as a second Web URI)*
2. **Certificates & secrets → New client secret.** Copy the secret **Value**.
3. Copy the **Application (client) ID** from the Overview tab.

---

## 3. Environment variables

### Vercel — Web project (the OAuth secrets live here)

| Variable | Value |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | Google client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google client secret |
| `MICROSOFT_OAUTH_CLIENT_ID` | Azure application (client) ID |
| `MICROSOFT_OAUTH_CLIENT_SECRET` | Azure client secret **value** |
| `MICROSOFT_OAUTH_TENANT` | `common` (optional; default is `common`) |
| `APP_URL` | `https://hailscout.net` (used to build redirect URIs) |
| `NEXT_PUBLIC_API_BASE_URL` | `https://hail-scout-production.up.railway.app` (already defaulted) |

### Railway — Hail-Scout API service (no client secrets needed here)

| Variable | Value |
|---|---|
| `SESSION_JWT_SECRET` | **Strong random string** (see below) — signs our access tokens |
| `GOOGLE_OAUTH_CLIENT_ID` | Same Google client ID (to validate token audience) |
| `MICROSOFT_OAUTH_CLIENT_ID` | Same Azure client ID |
| `MICROSOFT_OAUTH_TENANT` | `common` (match the web value) |
| `SESSION_ACCESS_TTL_SECONDS` | optional, default `3600` (1h) |
| `SESSION_REFRESH_TTL_DAYS` | optional, default `30` |

Generate `SESSION_JWT_SECRET`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
# or: openssl rand -base64 48
```

> Old Clerk variables (`CLERK_*`) are no longer read and can be deleted from both
> services.

---

## 4. Deploy

- **API (Railway):** set the variables above and redeploy. Migration `017_own_auth`
  runs automatically on boot (`alembic upgrade head`) — it renames
  `users.clerk_user_id → auth_subject` and adds the `user_sessions` table. No
  user rows are dropped.
- **Web (Vercel):** set the variables above and redeploy.

## 5. First sign-in

Sign in at `https://hailscout.net/sign-in` with the **Google or Microsoft account
whose email matches a seeded user** (e.g. `kirk@copayee.com` is the super-admin).
First login links that identity; sign-out + re-login works thereafter.

If you see *"No HailScout account exists for that email"*, the email isn't in the
`users` table yet — add it via super-admin **Tenant management → create org/admin**,
then sign in again.

## 6. Security notes / future hardening

- Access tokens are short-lived HS256 JWTs (`sub` = internal user id, + `email`,
  `org_id`). Refresh tokens are opaque, stored **hashed** in `user_sessions`, and
  **revocable** (sign-out flips `revoked_at`).
- Provider id_tokens are re-verified server-side (signature via provider JWKS +
  issuer + audience + expiry), so a compromised web tier can't forge identities.
- Not yet done (fine for launch, worth adding later): refresh-token **rotation**
  with reuse detection; passwordless **email magic-link** as a third sign-in
  method (needs the Resend/email integration that's currently parked).
