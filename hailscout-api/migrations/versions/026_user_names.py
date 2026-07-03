"""026 - Add first_name / last_name to users + backfill from the audit log.

Revision ID: 026_user_names
Revises: 025_alert_zones
Create Date: 2026-07-02

The users table never had a name column, so HR-provisioned reps showed up in
the Team UI as their email local-part (lowercase, no surname). The HR Portal
DID send firstName/lastName — the provisioning route recorded the joined name
into the audit event metadata (`provision.user_created` → metadata_json.name)
but had nowhere to persist it on the user.

This migration:
  1. adds nullable first_name / last_name columns, and
  2. backfills them from the audit log: for each user, take the earliest
     `provision.user_created` event's metadata name, and split it into first
     token / remainder. Only fills rows that are still NULL, so it's safe to
     re-run and never clobbers a name set another way.

Anyone with no provision event (e.g. social-only or admin-created accounts)
stays NULL and keeps the email-local-part fallback in the UI until a re-push
or an inline edit fills them in.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "026_user_names"
down_revision = "025_alert_zones"
branch_labels = None
depends_on = None


# Backfill from audit_events.metadata_json (TEXT holding JSON). Only
# provision.user_created rows are cast to jsonb, and those are always written
# via json.dumps(), so the cast is safe. Split the joined name on the first
# space: first token -> first_name, remainder -> last_name.
#
# Wrapped in a DO/EXCEPTION block so that — even in the impossible case a
# provision event holds non-JSON — the data step can never abort and roll
# back the column adds above it (boot runs `alembic upgrade head` and
# continues on error, so a rolled-back 026 would leave the model expecting
# columns the DB lacks). Worst case: names stay NULL and the UI falls back.
_BACKFILL = """
DO $$
BEGIN
    UPDATE users AS u
    SET first_name = NULLIF(split_part(n.full_name, ' ', 1), ''),
        last_name  = NULLIF(
            CASE
                WHEN position(' ' in n.full_name) > 0
                THEN trim(substring(n.full_name from position(' ' in n.full_name) + 1))
                ELSE ''
            END, '')
    FROM (
        SELECT DISTINCT ON (a.subject_id)
               a.subject_id                            AS uid,
               trim(a.metadata_json::jsonb ->> 'name') AS full_name
        FROM audit_events a
        WHERE a.action = 'provision.user_created'
          AND a.subject_id IS NOT NULL
          AND a.metadata_json IS NOT NULL
          AND coalesce(trim(a.metadata_json::jsonb ->> 'name'), '') <> ''
        ORDER BY a.subject_id, a.ts ASC
    ) AS n
    WHERE u.id = n.uid
      AND (u.first_name IS NULL OR u.first_name = '')
      AND (u.last_name IS NULL OR u.last_name = '');
EXCEPTION WHEN others THEN
    RAISE NOTICE 'user-name backfill skipped: %', SQLERRM;
END $$;
"""


def upgrade() -> None:
    op.add_column("users", sa.Column("first_name", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(length=120), nullable=True))
    op.execute(_BACKFILL)


def downgrade() -> None:
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
