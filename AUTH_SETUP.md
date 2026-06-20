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
| `SESSION_JWT_SECRET` | **Strong random string** (see below) — signs our access tokens; also keys the 2FA code HMAC |
| `GOOGLE_OAUTH_CLIENT_ID` | Same Google client ID (to validate token audience) |
| `MICROSOFT_OAUTH_CLIENT_ID` | Same Azure client ID |
| `MICROSOFT_OAUTH_TENANT` | `common` (match the web value) |
| `SESSION_ACCESS_TTL_SECONDS` | optional, default `3600` (1h) |
| `SESSION_IDLE_DAYS` | optional, default `7` — refresh rotation slides this idle window |
| `SESSION_MAX_DAYS` | optional, default `90` — absolute session cap from first sign-in |
| `REPLINE_BASE_URL` | RepLine gateway base URL — SMS 2FA codes (LOGIN-STANDARD §8) |
| `REPLINE_API_KEY` | RepLine API key with the `messages:send` scope |
| `REPLINE_AGENT_ID` | RepLine sending agent (the FROM number) |

> **SMS 2FA degrade:** until all three `REPLINE_*` vars are set, enrollment and
> login codes are **logged by the API instead of texted** (search the Railway
> logs for `sms.skipped_logged`) so the flow stays verifiable. Once configured,
> codes are never logged.

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

## 6. Security notes

- Access tokens are short-lived HS256 JWTs (`sub` = internal user id, + `email`,
  `org_id`, and `mfa_verified` / `scope: 'mfa_enroll'` when applicable). Refresh
  tokens are opaque, stored **hashed** in `user_sessions`, and **revocable**
  (sign-out flips `revoked_at`).
- **Refresh rotation + session lifetime (LOGIN-STANDARD §5):** every
  `/v1/auth/refresh` revokes the presented token and mints a successor — a
  7-day idle sliding window clamped to a 90-day absolute cap anchored at the
  original sign-in (`user_sessions.first_authenticated_at`); past the cap the
  refresh answers `401 session_expired`.
- Provider id_tokens are re-verified server-side (signature via provider JWKS +
  issuer + audience + expiry), so a compromised web tier can't forge identities.

## 7. SMS two-factor (LOGIN-STANDARD §4 — text codes only, no authenticator apps)

- **Enroll** under Settings → Security: phone (E.164) → texted 6-digit code →
  confirm → done. Texted codes are stored HMAC-only, 5-minute expiry,
  5-attempt cap. (No recovery/backup codes — SMS 2FA is bound to a phone
  number, which survives device loss via carrier SIM reissue.)
- **Login**: single POST `/v1/auth/login { email, password, mfa_code? }` — an
  enrolled account without a code gets a fresh code texted + `401 mfa_required`
  (resubmitting without a code = resend). MFA failures share the durable
  lockout counter (5 fails/15 min).
- **Remember this device** (90 days): an httpOnly `hs_device_trust` cookie skips
  the texted code — password still required. Revoked by Settings → Security →
  "Forget all remembered devices", MFA-disable, and password reset.
- **Enforcement**: `owner`/`admin` (and super-admins) must enroll for password
  logins — 7-day grace window with a nag, then login yields an enroll-scoped
  token usable only on the enrollment endpoints (`/mfa/enroll` page). **Social
  sign-ins inherit the provider's MFA and are never double-prompted.**
- Endpoints: `GET /v1/auth/mfa/status`, `POST /v1/auth/mfa/sms/start|verify|send`,
  `POST /v1/auth/mfa/disable`, `POST /v1/auth/mfa/trusted-devices/forget`.
