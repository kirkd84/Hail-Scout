# HailScout — Session Handoff (2026-04-27 evening)

State of the world after Kirk's autonomous-work request.

---

## What's live

| Surface | Status | URL |
|---|---|---|
| GitHub repo (monorepo) | ✓ pushed | https://github.com/kirkd84/Hail-Scout |
| Railway project | ✓ provisioned | `exciting-possibility` |
| Postgres (Railway) | ✓ Online | (via `${{Postgres.DATABASE_URL}}` ref) |
| API service (Railway) | ⚠ build OK, runtime 502 | https://hail-scout-production.up.railway.app |
| Public domain | ✓ generated | port 8080 |
| Web (Vercel) | ✗ not deployed | — |
| Mobile (EAS) | ✗ not built | — |

**The API deploys but `/v1/health` returns 502.** Build succeeds; container appears to start but proxy can't reach it. Most likely culprits, in order:

1. The pip-based Dockerfile rewrite may not have finished its first successful run — Railway's last visible deploy log was the poetry-based image that crashed on `uvicorn: not found`. Need to verify the most recent build is the pip one.
2. Pydantic v2 config used `Field(env="X")` which is deprecated; **fixed in this session** (config.py rewritten to `model_config` + plain attribute defaults). Worth confirming the new image was deployed.
3. Async DB driver mismatch: `create_async_engine` requires `postgresql+asyncpg://`; Railway gives `postgresql://`. **Fixed:** `_normalize_async_url` in session.py + alembic env.py.
4. Health route is at `/v1/health` (mounted under `/v1`), NOT `/health`. The Dockerfile's `HEALTHCHECK` probes `/health` and gets 404. Doesn't break the deploy, but Railway may use it as a signal.

---

## What was built tonight

### Multi-tenancy + super admin
- `migrations/versions/002_add_is_super_admin.py` — adds `is_super_admin` boolean to `users` with index.
- `db/models/org.py` — User model now has `is_super_admin`.
- `auth/super_admin.py` — `require_super_admin` FastAPI dependency. 401 if no auth, 403 if not super admin.
- `routes/admin.py` — `/v1/admin/orgs` (GET/POST), `/v1/admin/orgs/{id}/usage`, `/v1/admin/orgs/{id}/users`, `/v1/admin/users/super-admin` (POST). Lock-out guard prevents revoking the last super admin.
- `schemas/admin.py` — Pydantic models for the admin endpoints.
- `seed.py` — idempotent bootstrap script. Creates `HailScout Demo` and `Roof Technologies` orgs, seeds `kirk@copayee.com` as super-admin (cross-tenant), `kirk@rooftechnologies.com` as Roof Technologies admin.
- `main.py` — admin router mounted under `/v1/admin/*`.
- `Dockerfile` — startup chain is now `alembic upgrade head && python -m hailscout_api.seed && uvicorn …`.

### Web — super-admin shell
- `/super-admin/orgs` — list every tenant + create new tenants (with optional admin email).
- `/super-admin/users` — promote / demote super-admins by email.
- `/super-admin/usage` — per-tenant usage drilldown.
- `hooks/useMe.ts` — caches `/v1/me` so the sidebar can conditionally render.
- `components/app/sidebar.tsx` — renders an amber "Super: Tenant management" link only when `me.user.is_super_admin === true`.
- `schemas/me.py` + `routes/me.py` — `/v1/me` now includes `is_super_admin`.

### API runtime fixes
- Dockerfile rewritten from poetry multi-stage to plain pip single-stage. Removed venv-copy quirks.
- `_normalize_async_url` coerces `postgres://` and `postgresql://` → `postgresql+asyncpg://` for SQLAlchemy async engine. Applied in both runtime and migrations.
- Pydantic v2 settings: `SettingsConfigDict` instead of inner `Config` class; plain typed attributes instead of `Field(env=…)`.
- `CMD` in shell form so `$PORT` (Railway) is honored.

---

## Configuration snapshot

### Seed identities
| Email | Role | Org | Super admin? |
|---|---|---|---|
| kirk@copayee.com | admin | HailScout Demo | **yes** |
| kirk@rooftechnologies.com | admin | Roof Technologies | no |

These are created idempotently every container boot. Re-running seed is safe.

### Railway env vars set
- `DATABASE_URL` — reference `${{Postgres.DATABASE_URL}}`
- (Everything else uses defaults from `config.py`. Add `CLERK_SECRET_KEY` and `CLERK_JWKS_ENDPOINT` for real auth.)

### Public URLs
- API: `https://hail-scout-production.up.railway.app`
- API base path: `/v1`
- Health: `/v1/health` (when alive)

---

## Hard-blocked / needs a human

1. **Verify the latest Dockerfile actually deployed.** Look at the most recent COMPLETED build's logs and confirm it was the pip-based one (line 1 will be `FROM python:3.12-slim`, NOT `python:3.12-slim as builder`).
2. **`/v1/health` 502 → read the runtime logs** of the latest deploy. Most likely: the import chain throws because of one specific package mismatch. Fix and redeploy.
3. **Clerk wiring.** The seed creates users with placeholder `clerk_user_id` like `pending_kirk_xyz`. They must be reconciled when those emails sign in for real. Webhook handler not yet built.
4. **GitHub MCP connector.** Ask the Cowork team to add a GitHub MCP. The bash sandbox can clone but can't push (no creds). Until then, deploys go via the Drive folder + `bootstrap-git.bat` flow.

---

## Suggested next 3 things to test in the morning

1. **Confirm the deploy is green.** `curl https://hail-scout-production.up.railway.app/v1/health` should return `{"status":"ok","db":"ok",...}`. If 502, paste the deploy log into chat.
2. **Confirm the seed ran.** Connect to the Railway Postgres, run `SELECT email, role, is_super_admin FROM users;`. Should show the two seeded users.
3. **Sign in flow end-to-end.** Set up Clerk app, drop publishable + secret keys into Railway env vars, sign up as kirk@copayee.com, confirm the Super-admin link appears in the sidebar and `/super-admin/orgs` lists the two seeded orgs.

---

## Files touched this session (high-signal subset)

```
hailscout-api/Dockerfile
hailscout-api/migrations/env.py
hailscout-api/migrations/versions/002_add_is_super_admin.py     [NEW]
hailscout-api/src/hailscout_api/auth/super_admin.py             [NEW]
hailscout-api/src/hailscout_api/config.py
hailscout-api/src/hailscout_api/db/models/org.py
hailscout-api/src/hailscout_api/db/session.py
hailscout-api/src/hailscout_api/main.py
hailscout-api/src/hailscout_api/routes/__init__.py
hailscout-api/src/hailscout_api/routes/admin.py                 [NEW]
hailscout-api/src/hailscout_api/routes/me.py
hailscout-api/src/hailscout_api/schemas/admin.py                [NEW]
hailscout-api/src/hailscout_api/schemas/me.py
hailscout-api/src/hailscout_api/seed.py                         [NEW]

hailscout-web/src/app/super-admin/layout.tsx                    [NEW]
hailscout-web/src/app/super-admin/orgs/page.tsx                 [NEW]
hailscout-web/src/app/super-admin/users/page.tsx                [NEW]
hailscout-web/src/app/super-admin/usage/page.tsx                [NEW]
hailscout-web/src/components/app/sidebar.tsx
hailscout-web/src/hooks/useMe.ts                                [NEW]
```

All of the above is in the Drive folder. **None of it has been pushed to GitHub yet.** Run `bootstrap-git.bat` to push (or I can do it via computer-use when you're back).
