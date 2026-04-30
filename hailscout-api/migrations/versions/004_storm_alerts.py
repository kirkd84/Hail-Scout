"""004 - Storm alerts table.

Revision ID: 004_storm_alerts
Revises: 003_simplify_canvass
Create Date: 2026-04-29

Lazy-generated alerts when a storm fixture touches a monitored address.
The /v1/alerts endpoint computes new matches on each fetch and persists
them here, idempotent by (org_id, monitored_address_id, storm_id).
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "004_storm_alerts"
down_revision = "003_simplify_canvass"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "storm_alerts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("org_id", sa.String(255), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("monitored_address_id", sa.Integer(), sa.ForeignKey("monitored_addresses.id"), nullable=False),
        sa.Column("storm_id", sa.String(255), nullable=False),
        sa.Column("storm_city", sa.String(255), nullable=True),
        sa.Column("peak_size_in", sa.Float(), nullable=False),
        sa.Column("storm_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_storm_alerts_org_id", "storm_alerts", ["org_id"])
    op.create_index("ix_storm_alerts_monitored_address_id", "storm_alerts", ["monitored_address_id"])
    op.create_index("ix_storm_alerts_storm_id", "storm_alerts", ["storm_id"])
    # Composite uniq for idempotent alert generation
    op.create_index(
        "ux_storm_alerts_dedup",
        "storm_alerts",
        ["org_id", "monitored_address_id", "storm_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ux_storm_alerts_dedup", table_name="storm_alerts")
    op.drop_index("ix_storm_alerts_storm_id", table_name="storm_alerts")
    op.drop_index("ix_storm_alerts_monitored_address_id", table_name="storm_alerts")
    op.drop_index("ix_storm_alerts_org_id", table_name="storm_alerts")
    op.drop_table("storm_alerts")
