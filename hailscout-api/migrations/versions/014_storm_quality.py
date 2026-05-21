"""014 - Storm quality / confidence columns.

Revision ID: 014_storm_quality
Revises: 013_alert_emails_and_lsr
Create Date: 2026-05-20

Phase 23.5 — false-positive screening.

MRMS MESH and single-radar NEXRAD both produce occasional spurious
giant-hail readings (bird bloom, anaprop, single-pixel noise, beam
overshoot at range). We need a way to flag those without removing
them from the DB — useful both for "show me everything" debugging
and so a future model can learn from the labels.

Approach: a `confidence` score on each Storm (0..1), a boolean
`suspect` flag derived from it for cheap filtering, and a
`suspect_reasons` comma-separated tag list for explainability.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "014_storm_quality"
down_revision = "013_alert_emails_and_lsr"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "storms",
        sa.Column("confidence", sa.Float(),
                  nullable=False, server_default=sa.text("1.0")),
    )
    op.add_column(
        "storms",
        sa.Column("suspect", sa.Boolean(),
                  nullable=False, server_default=sa.text("false"),
                  index=False),
    )
    op.add_column(
        "storms",
        sa.Column("suspect_reasons", sa.String(255), nullable=True),
    )
    op.add_column(
        "storms",
        sa.Column("screened_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Index on suspect so the default-hide query on /v1/storms is cheap
    # (most queries will be `WHERE NOT suspect` once the screener has
    # run; without an index that's a full-table scan over millions of
    # rows).
    op.create_index("ix_storms_suspect", "storms", ["suspect"])


def downgrade() -> None:
    op.drop_index("ix_storms_suspect", table_name="storms")
    op.drop_column("storms", "screened_at")
    op.drop_column("storms", "suspect_reasons")
    op.drop_column("storms", "suspect")
    op.drop_column("storms", "confidence")
