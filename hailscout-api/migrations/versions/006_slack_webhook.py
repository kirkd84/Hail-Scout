"""006 - Slack webhook URL on organizations.

Revision ID: 006_slack_webhook
Revises: 005_saved_reports
Create Date: 2026-04-30

Stores a Slack incoming-webhook URL per org. When the alert generator
runs and produces new matches, the API POSTs a formatted message to
this URL — no extra infra, no API keys we hold.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "006_slack_webhook"
down_revision = "005_saved_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("slack_webhook_url", sa.String(512), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("slack_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("organizations", "slack_enabled")
    op.drop_column("organizations", "slack_webhook_url")
