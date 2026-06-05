"""019 - Add is_disabled / disabled_at to users.

Revision ID: 019_user_disabled
Revises: 018_sms_push_alerts
Create Date: 2026-06-05

Account disable flag for the external HR provisioning API
(POST /api/provision/user/disable). A disabled user is rejected at OAuth
exchange and has all refresh sessions revoked. Defaults to false so every
existing row stays enabled.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "019_user_disabled"
down_revision = "018_sms_push_alerts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_disabled",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "disabled_at")
    op.drop_column("users", "is_disabled")
