"""008 - Marker assignment to a crew member.

Revision ID: 008_marker_assignee
Revises: 007_audit_events
Create Date: 2026-04-30

Adds assignee_user_id (FK -> users.id, nullable) so contractors can
assign markers to specific crew members for canvassing.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "008_marker_assignee"
down_revision = "007_audit_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "markers",
        sa.Column("assignee_user_id", sa.String(255), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("ix_markers_assignee_user_id", "markers", ["assignee_user_id"])


def downgrade() -> None:
    op.drop_index("ix_markers_assignee_user_id", table_name="markers")
    op.drop_column("markers", "assignee_user_id")
