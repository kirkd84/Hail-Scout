"""013 - Email alerts + LSR↔NEXRAD confirmation columns.

Revision ID: 013_alert_emails_and_lsr
Revises: 012_hail_swath_uniq
Create Date: 2026-05-19

Phase 23.

- organizations: per-org email recipient list + enable flag + min size
  threshold for alert delivery (mirrors the existing Slack pattern).
- storm_alerts: delivery-tracking timestamps so re-running the alert
  generator doesn't re-send.
- storms: LSR-confirmation columns. When a SPC Local Storm Report
  falls inside a NEXRAD cell footprint within ±30 min, we stamp the
  NEXRAD storm with the ground-truth observation. Alerts can then
  prefer confirmed cells (and surface them as such in the UI).
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "013_alert_emails_and_lsr"
down_revision = "012_hail_swath_uniq"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # organizations: email alert config
    op.add_column(
        "organizations",
        sa.Column("alert_emails_enabled", sa.Boolean(),
                  nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "organizations",
        sa.Column("alert_email_recipients", sa.String(2048), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("alert_min_size_in", sa.Float(),
                  nullable=False, server_default=sa.text("0.75")),
    )

    # storm_alerts: delivery tracking
    op.add_column(
        "storm_alerts",
        sa.Column("email_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "storm_alerts",
        sa.Column("slack_sent_at", sa.DateTime(timezone=True), nullable=True),
    )

    # storms: LSR confirmation columns
    op.add_column(
        "storms",
        sa.Column("lsr_confirmed", sa.Boolean(),
                  nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "storms",
        sa.Column("lsr_observed_size_in", sa.Float(), nullable=True),
    )
    op.add_column(
        "storms",
        sa.Column("lsr_observed_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Index just on the confirmation flag so the UI can cheaply filter
    # "confirmed-only" leaderboards.
    op.create_index(
        "ix_storms_lsr_confirmed", "storms", ["lsr_confirmed"],
    )


def downgrade() -> None:
    op.drop_index("ix_storms_lsr_confirmed", table_name="storms")
    op.drop_column("storms", "lsr_observed_at")
    op.drop_column("storms", "lsr_observed_size_in")
    op.drop_column("storms", "lsr_confirmed")
    op.drop_column("storm_alerts", "slack_sent_at")
    op.drop_column("storm_alerts", "email_sent_at")
    op.drop_column("organizations", "alert_min_size_in")
    op.drop_column("organizations", "alert_email_recipients")
    op.drop_column("organizations", "alert_emails_enabled")
