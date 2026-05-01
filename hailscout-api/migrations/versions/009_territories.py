"""009 - Territory zones table.

Revision ID: 009_territories
Revises: 008_marker_assignee
Create Date: 2026-04-30

Named polygon zones a sales manager assigns to a teammate or crew.
Polygon stored as JSON of [lng,lat] pairs (no PostGIS geom yet — keep
parity with the markers/addresses lite path).
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "009_territories"
down_revision = "008_marker_assignee"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "territories",
        sa.Column("id",      sa.String(255), primary_key=True),
        sa.Column("org_id",  sa.String(255), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name",    sa.String(255), nullable=False),
        sa.Column("color",   sa.String(16),  nullable=True),
        sa.Column("polygon_json", sa.Text(), nullable=False),
        sa.Column("assignee_user_id", sa.String(255), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("notes",   sa.Text(),  nullable=True),
        sa.Column("created_by_user_id", sa.String(255), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_territories_org_id",  "territories", ["org_id"])
    op.create_index("ix_territories_assignee", "territories", ["assignee_user_id"])


def downgrade() -> None:
    op.drop_index("ix_territories_assignee", table_name="territories")
    op.drop_index("ix_territories_org_id",   table_name="territories")
    op.drop_table("territories")
