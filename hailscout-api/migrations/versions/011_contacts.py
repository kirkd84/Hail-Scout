"""011 - Contacts table for CRM-lite.

Revision ID: 011_contacts
Revises: 010_marker_notes
Create Date: 2026-04-30

Customer/contact records optionally linked to a monitored address.
This is the lightweight version — extend later with phone history,
deal pipeline, etc.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "011_contacts"
down_revision = "010_marker_notes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hs_contacts",
        sa.Column("id", sa.String(255), primary_key=True),
        sa.Column("org_id", sa.String(255), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("monitored_address_id", sa.Integer(), sa.ForeignKey("monitored_addresses.id"), nullable=True),
        sa.Column("name",   sa.String(255), nullable=False),
        sa.Column("email",  sa.String(255), nullable=True),
        sa.Column("phone",  sa.String(64),  nullable=True),
        sa.Column("status", sa.String(32),  nullable=False, server_default="prospect"),
        sa.Column("notes",  sa.Text(),      nullable=True),
        sa.Column("follow_up_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", sa.String(255), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_hs_contacts_org_id",  "hs_contacts", ["org_id"])
    op.create_index("ix_hs_contacts_address", "hs_contacts", ["monitored_address_id"])
    op.create_index("ix_hs_contacts_status",  "hs_contacts", ["status"])
    op.create_index("ix_hs_contacts_follow_up_at", "hs_contacts", ["follow_up_at"])


def downgrade() -> None:
    op.drop_index("ix_hs_contacts_follow_up_at", table_name="hs_contacts")
    op.drop_index("ix_hs_contacts_status",  table_name="hs_contacts")
    op.drop_index("ix_hs_contacts_address", table_name="hs_contacts")
    op.drop_index("ix_hs_contacts_org_id",  table_name="hs_contacts")
    op.drop_table("hs_contacts")
