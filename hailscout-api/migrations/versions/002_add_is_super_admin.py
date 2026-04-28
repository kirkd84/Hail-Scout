"""002 - Add is_super_admin flag to users

Revision ID: 002_add_is_super_admin
Revises: 001_initial_schema
Create Date: 2026-04-27

System-level super-admin flag (cross-tenant). Independent of the org-level
`role` column. Defaults to false. Set true via seed script for kirk@copayee.com.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "002_add_is_super_admin"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_super_admin",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    # Index so super-admin lookups are O(1) per request, not a table scan.
    op.create_index("ix_users_is_super_admin", "users", ["is_super_admin"])


def downgrade() -> None:
    op.drop_index("ix_users_is_super_admin", table_name="users")
    op.drop_column("users", "is_super_admin")
