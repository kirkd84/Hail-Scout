"""010 - marker_notes table for append-only conversation thread.

Revision ID: 010_marker_notes
Revises: 009_territories
Create Date: 2026-04-30
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "010_marker_notes"
down_revision = "009_territories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "marker_notes",
        sa.Column("id",        sa.Integer(),   primary_key=True, autoincrement=True),
        sa.Column("marker_id", sa.String(255), sa.ForeignKey("markers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("org_id",    sa.String(255), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("user_id",   sa.String(255), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body",      sa.Text(),      nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_marker_notes_marker_id", "marker_notes", ["marker_id"])
    op.create_index("ix_marker_notes_org_id",    "marker_notes", ["org_id"])


def downgrade() -> None:
    op.drop_index("ix_marker_notes_org_id",    table_name="marker_notes")
    op.drop_index("ix_marker_notes_marker_id", table_name="marker_notes")
    op.drop_table("marker_notes")
