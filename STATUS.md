# HailScout — Live deployment

**API is live and healthy.**

---

## Live state

| Surface | Status | URL |
|---|---|---|
| GitHub repo (monorepo) | ✓ pushed | https://github.com/kirkd84/Hail-Scout |
| Railway project | ✓ provisioned | `exciting-possibility` |
| Postgres + **PostGIS** | ✓ Online | `postgis/postgis:16-3.4` |
| **API service** | **✓ /v1/health = 200** | https://hail-scout-production.up.railway.app |
| Web (Vercel) | ✗ not deployed | (next: deploy hailscout-web) |
| Mobile (EAS) | ✗ not built | (later) |

API endpoints (auth-gated where applicable):
- `GET /` — service info
- `GET /healthz` — root liveness probe (no DB)
- `GET /v1/health` — full health (DB ping)
- `GET /docs` — OpenAPI / Swagger UI
- `GET /v1/me` — current user + org + seats
- `GET /v1/storms?bbox=&from=&to=` — storms in bbox/date range
- `GET /v1/hail-at-address?address=` — storm history at an address
- `GET /v1/admin/orgs` — super-admin: list every tenant org
- `POST /v1/admin/orgs` — super-admin: create new tenant
- `GET /v1/admin/orgs/{id}/usage` — super-admin: per-tenant usage
- `GET /v1/admin/orgs/{id}/users` — super-admin: list org users
- `POST /v1/admin/users/super-admin` — super-admin: grant/revoke

---

## Seed identities

These are inserted idempotently every container boot. Seed script lives at `hailscout-api/src/hailscout_api/seed.py`.

| Email | Role | Org | Super admin? |
|---|---|---|---|
| kirk@copayee.com | admin | HailScout Demo | **yes (cross-tenant)** |
| kirk@rooftechnologies.com | admin | Roof Technologies | no |

Both users have placeholder `clerk_user_id` values (`pending_kirk_*`). On first sign-in via Clerk, the webhook handler (TODO) needs to reconcile the Clerk user ID into the existing row. Until that webhook exists, do it manually with a SQL UPDATE.

---

## What it took to get here (debug log)

In rough order of crashes & fixes during the deploy iteration:

1. Build failed: no Dockerfile at repo root → set Railway root directory to `hailscout-api/`.
2. Crashed: missing `DATABASE_URL` → wired Postgres reference variable.
3. Crashed: `/app/.venv/bin/uvicorn: No such file or directory` → poetry's in-project venv was unreliable in multi-stage; switched to single-stage pip install.
4. Crashed: `extension "postgis" is not available` → swapped Railway Postgres image to `postgis/postgis:16-3.4`, wiped volume to clear PG18 config drift.
5. Crashed: `ArgumentError: Column object 'created_at' already assigned to Table` → converted `id_column`/`created_at_column`/`updated_at_column` to factory functions in `db/base.py` (each model needs its OWN Column instance).
6. Crashed: `ModuleNotFoundError: email_validator` → `pydantic[email]` extra now installed in Dockerfile.
7. Crashed: `SyntaxError on main.py line 71 async ` → Drive sync was silently truncating files I wrote via the Drive folder. Switched to bypass-Drive workflow: write directly into `/tmp` git clone, push from there.

After fix #7: clean boot, `/v1/health` returns 200.

---

## Next steps

### 1. Wire Clerk auth (so users can actually sign in)

a. Sign up at https://clerk.com (free tier). Create an Application.
b. From the Clerk dashboard, copy:
   - **Publishable key** (`pk_test_...`)
   - **Secret key** (`sk_test_...`)
   - **JWKS endpoint** — under "API keys" → "Show JWT public key" → copy the full URL (something like `https://<your-instance>.clerk.accounts.dev/.well-known/jwks.json`)
c. In Railway → Hail-Scout service → Variables tab, add:
   - `CLERK_SECRET_KEY` = `sk_test_...`
   - `CLERK_JWKS_ENDPOINT` = `https://<your-instance>.clerk.accounts.dev/.well-known/jwks.json`
d. Click Deploy on the pending change.
e. Sign up at the (yet-to-be-deployed) web app as `kirk@copayee.com`. The first sign-in needs the Clerk webhook to reconcile the `pending_kirk_*` placeholder to the real Clerk user ID — until the webhook exists, manually update via psql:
   ```sql
   UPDATE users SET clerk_user_id = '<the-real-clerk-user-id>'
   WHERE email = 'kirk@copayee.com';
   ```

### 2. Deploy `hailscout-web` to Vercel

a. https://vercel.com → Add New → Project → Import `kirkd84/Hail-Scout`
b. **Root Directory:** `hailscout-web`
c. Framework Preset: Next.js (auto-detected)
d. Environment Variables:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_test_...`
   - `CLERK_SECRET_KEY` = `sk_test_...`
   - `NEXT_PUBLIC_API_BASE_URL` = `https://hail-scout-production.up.railway.app`
   - `NEXT_PUBLIC_TILES_BASE_URL` = (placeholder; tiles service not yet deployed)
e. Deploy.

### 3. Smoke test the super-admin flow

- Open the Vercel URL → sign in as `kirk@copayee.com`
- Sidebar should show the amber "Super: Tenant management" link (visible only when `me.user.is_super_admin === true`)
- Click → `/super-admin/orgs` should list `HailScout Demo` and `Roof Technologies`
- Click `/super-admin/users` to test promote/demote
- Click `/super-admin/usage` to see per-tenant stats (most counters are stubbed pending data pipeline)

---

## Hard-blocked / needs a human

1. **Clerk webhook handler** — the seed creates users with `pending_*` placeholders. Until a Clerk webhook reconciles them on first sign-in, you'll need to manually `UPDATE users SET clerk_user_id = ...` after the first login. Building the webhook is a small lift (~30 min) — not done tonight.
2. **Data pipeline (`hailscout-data-pipeline`)** — not yet deployed. Without it, the API has no storm data. Storm endpoints return empty results until the pipeline is live.
3. **Tiles service (`hailscout-tiles`)** — not yet deployed. Map will show base tiles only; no swath overlays.
4. **Mobile (`hailscout-mobile`)** — not yet built. EAS build is a separate workstream.

---

## Recovery / iteration notes

- **Push workflow:** clone `kirkd84/Hail-Scout` into a fresh dir, edit, `git push` with the PAT URL `https://${TOKEN}@github.com/kirkd84/Hail-Scout.git`. Railway auto-deploys on push to `main`.
- **Drive sync warning:** Drive folder periodically truncates files I write through Cowork's Write tool. Always verify with `wc -l` and `python3 -c "import ast; ast.parse(open(F).read())"` before pushing. Or skip Drive entirely and write directly into the cloned repo.
- **Boot diagnostic:** the Dockerfile's CMD echoes every step (`[boot] step 0/4`, `[boot] step 1/4`...) so the Deploy Logs tab tells you exactly where any future crash happens.
