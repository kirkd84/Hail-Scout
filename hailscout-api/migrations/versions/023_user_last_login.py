"""023 - Add last_login_at to users.

Revision ID: 023_user_last_login
Revises: 022_sms_mfa_session_policy
Create Date: 2026-06-18

Most recent successful sign-in (OAuth exchange or password login), stamped by
the auth routes. Nullable so every existing row and never-signed-in user stays
NULL. Read back by GET /api/provision/user/status as lastLoginAt so the HR
Portal can distinguish an invited account from an active one.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "023_user_last_login"
down_revision = "022_sms_mfa_session_policy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "last_login_at")
