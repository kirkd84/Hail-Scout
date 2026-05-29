"""015 - Persist dual-pol hail confirmation + peak reflectivity.

Revision ID: 015_dualpol_persistence
Revises: 014_storm_quality
Create Date: 2026-05-29

The NEXRAD pipeline computes a polarimetric (dual-pol) hail signature
for every cell — `hail_confirmed` (ZDR + RhoHV match the hail-vs-rain
pattern at the cell's high-reflectivity gates) and `hail_gate_fraction`
(what share of the cell's gates carry that signature) — plus the
`peak_dbz` composite reflectivity. Until now all three were computed
in `process_volume_scan` and then DISCARDED at upsert: only the size
estimate + footprint survived.

That's the single most valuable signal we have for "is this real hail
vs. reflective rain" and it's exactly what HailStrike / HailRecon's
single-source MESH products lack. Persisting it makes it queryable
by the API, renderable in the claims report, and usable in the
verification score.

All three columns are nullable / defaulted, so this is a safe online
ADD COLUMN even while the backfill is actively writing rows.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "015_dualpol_persistence"
down_revision = "014_storm_quality"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "storms",
        sa.Column("hail_confirmed", sa.Boolean(),
                  nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "storms",
        sa.Column("hail_gate_fraction", sa.Float(), nullable=True),
    )
    op.add_column(
        "storms",
        sa.Column("peak_dbz", sa.Float(), nullable=True),
    )
    # Partial index: "confirmed real hail" is a common high-value filter
    # (leaderboards, calibration, confident alerts) — keep it cheap.
    op.create_index(
        "ix_storms_hail_confirmed", "storms", ["hail_confirmed"],
    )


def downgrade() -> None:
    op.drop_index("ix_storms_hail_confirmed", table_name="storms")
    op.drop_column("storms", "peak_dbz")
    op.drop_column("storms", "hail_gate_fraction")
    op.drop_column("storms", "hail_confirmed")
