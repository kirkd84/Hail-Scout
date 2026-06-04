"""016 - Record radar hail size at the LSR point (accurate calibration).

Revision ID: 016_radar_size_at_lsr
Revises: 015_dualpol_persistence
Create Date: 2026-06-04

The calibration paired each radar cell's GLOBAL peak (max_hail_size_in)
against the ground-truth LSR report size. A storm can span 50+ km with
a 3" core miles from the LSR point that only saw 1.25" — so max-vs-point
systematically inflated the error (~20% within 0.25" — misleading).

This adds `radar_size_at_lsr_in`: the hail size the radar showed AT the
LSR's exact location (the largest swath band containing the report
point), populated by the LSR linker. Calibration then compares
like-for-like: radar-size-at-point vs reported-size-at-point.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "016_radar_size_at_lsr"
down_revision = "015_dualpol_persistence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "storms",
        sa.Column("radar_size_at_lsr_in", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("storms", "radar_size_at_lsr_in")
