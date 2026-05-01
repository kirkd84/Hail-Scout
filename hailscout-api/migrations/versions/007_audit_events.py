"""007 - Audit events table.

Revision ID: 007_audit_events
Revises: 006_slack_webhook
Create Date: 2026-04-30

Records key workspace operations for the super-admin audit viewer.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "007_audit_events"
down_revision = "006_slack_webhook"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id",      sa.Integer(),     primary_key=True, autoincrement=True),
        sa.Column("ts",      sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("org_id",  sa.String(255),   sa.ForeignKey("organizations.id"), nullable=True),
        sa.Column("user_id", sa.String(255),   sa.ForeignKey("users.id"),         nullable=True),
        sa.Column("action",  sa.String(100),   nullable=False),
        sa.Column("subject_type", sa.String(50), nullable=True),
        sa.Column("subject_id",   sa.String(255), nullable=True),
        sa.Column("metadata_json", sa.Text(),  nullable=True),
    )
    op.create_index("ix_audit_events_ts",        "audit_events", ["ts"])
    op.create_index("ix_audit_events_org_id",    "audit_events", ["org_id"])
    op.create_index("ix_audit_events_user_id",   "audit_events", ["user_id"])
    op.create_index("ix_audit_events_action",    "audit_events", ["action"])


def downgrade() -> None:
    op.drop_index("ix_audit_events_action",  table_name="audit_events")
    op.drop_index("ix_audit_events_user_id", table_name="audit_events")
    op.drop_index("ix_audit_events_org_id",  table_name="audit_events")
    op.drop_index("ix_audit_events_ts",      table_name="audit_events")
    op.drop_table("audit_events")
