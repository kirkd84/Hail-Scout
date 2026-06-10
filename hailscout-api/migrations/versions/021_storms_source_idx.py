"""021 - Composite index on storms(source, start_time).

Every hot query filters on source (SPC-LSR fusion, source-filtered storm
lists, stats rollups) and most also bound start_time — but no index covered
source at all, so they scanned. With ~46k LSR rows + the radar backfill this
was a measurable cost on public endpoints.

Revision ID: 021_storms_source_idx
Revises: 020_api_tokens
Create Date: 2026-06-10
"""

from __future__ import annotations

from alembic import op

revision = "021_storms_source_idx"
down_revision = "020_api_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_storms_source_start_time",
        "storms",
        ["source", "start_time"],
    )


def downgrade() -> None:
    op.drop_index("ix_storms_source_start_time", table_name="storms")
