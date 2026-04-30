"""005 - Saved Reports + org branding.

Revision ID: 005_saved_reports
Revises: 004_storm_alerts
Create Date: 2026-04-29

Persistent record of every Hail Impact Report a user generates plus
per-org branding overrides applied to future reports.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "005_saved_reports"
down_revision = "004_storm_alerts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_reports",
        sa.Column("id", sa.String(255), primary_key=True),
        sa.Column("org_id",  sa.String(255), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("user_id", sa.String(255), sa.ForeignKey("users.id"),         nullable=False),
        sa.Column("storm_id",     sa.String(255), nullable=True),
        sa.Column("storm_city",   sa.String(255), nullable=True),
        sa.Column("address",      sa.String(500), nullable=True),
        sa.Column("address_lat",  sa.Float(),     nullable=True),
        sa.Column("address_lng",  sa.Float(),     nullable=True),
        sa.Column("peak_size_in", sa.Float(),     nullable=True),
        sa.Column("storm_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(),      nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_saved_reports_org_id",  "saved_reports", ["org_id"])
    op.create_index("ix_saved_reports_user_id", "saved_reports", ["user_id"])

    # Per-org branding overrides used by the report PDF
    op.add_column("organizations", sa.Column("brand_logo_url",   sa.String(500), nullable=True))
    op.add_column("organizations", sa.Column("brand_primary",    sa.String(16),  nullable=True))
    op.add_column("organizations", sa.Column("brand_accent",     sa.String(16),  nullable=True))
    op.add_column("organizations", sa.Column("brand_company_name", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("organizations", "brand_company_name")
    op.drop_column("organizations", "brand_accent")
    op.drop_column("organizations", "brand_primary")
    op.drop_column("organizations", "brand_logo_url")
    op.drop_index("ix_saved_reports_user_id", table_name="saved_reports")
    op.drop_index("ix_saved_reports_org_id",  table_name="saved_reports")
    op.drop_table("saved_reports")
