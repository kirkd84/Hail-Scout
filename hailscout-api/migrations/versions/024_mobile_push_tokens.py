"""mobile push tokens + storm_alerts.mobile_push_sent_at

Adds the native app's Expo push-token store and a per-alert idempotency
timestamp for the mobile-push channel, mirroring the web-push columns.

Revision ID: 024_mobile_push_tokens
Revises: 023_user_last_login
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "024_mobile_push_tokens"
down_revision = "023_user_last_login"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mobile_push_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "org_id",
            sa.String(),
            sa.ForeignKey("organizations.id"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token", sa.String(length=255), nullable=False),
        sa.Column("platform", sa.String(length=16), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_mobile_push_tokens_org_id", "mobile_push_tokens", ["org_id"]
    )
    op.create_index(
        "ix_mobile_push_tokens_user_id", "mobile_push_tokens", ["user_id"]
    )
    op.create_unique_constraint(
        "uq_mobile_push_tokens_token", "mobile_push_tokens", ["token"]
    )
    op.add_column(
        "storm_alerts",
        sa.Column("mobile_push_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("storm_alerts", "mobile_push_sent_at")
    op.drop_index("ix_mobile_push_tokens_user_id", table_name="mobile_push_tokens")
    op.drop_index("ix_mobile_push_tokens_org_id", table_name="mobile_push_tokens")
    op.drop_table("mobile_push_tokens")
