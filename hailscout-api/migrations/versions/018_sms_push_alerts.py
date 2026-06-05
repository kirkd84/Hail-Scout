"""018 - SMS + web-push alert channels.

Revision ID: 018_sms_push_alerts
Revises: 017_own_auth
Create Date: 2026-06-05

Adds two real-time alert channels alongside email/Slack:
* organizations: sms_enabled, sms_recipients, push_enabled
* storm_alerts: sms_sent_at, push_sent_at (per-channel idempotency)
* push_subscriptions: one row per signed-in browser/device
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "018_sms_push_alerts"
down_revision = "017_own_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("sms_enabled", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "organizations",
        sa.Column("sms_recipients", sa.String(length=2048), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("push_enabled", sa.Boolean(), server_default="false", nullable=False),
    )

    op.add_column(
        "storm_alerts",
        sa.Column("sms_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "storm_alerts",
        sa.Column("push_sent_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column(
            "org_id",
            sa.String(length=255),
            sa.ForeignKey("organizations.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.String(length=255),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("endpoint", sa.Text(), nullable=False, unique=True),
        sa.Column("p256dh", sa.String(length=512), nullable=False),
        sa.Column("auth", sa.String(length=512), nullable=False),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("push_subscriptions")
    op.drop_column("storm_alerts", "push_sent_at")
    op.drop_column("storm_alerts", "sms_sent_at")
    op.drop_column("organizations", "push_enabled")
    op.drop_column("organizations", "sms_recipients")
    op.drop_column("organizations", "sms_enabled")
