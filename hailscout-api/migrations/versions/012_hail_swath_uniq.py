"""012 - Add unique constraint on (storm_id, hail_size_category)

Required for the data pipeline's idempotent ON CONFLICT upsert pattern.

Revision ID: 012_hail_swath_uniq
Revises: 011_contacts
Create Date: 2026-05-03
"""
from __future__ import annotations
from alembic import op


revision = "012_hail_swath_uniq"
down_revision = "011_contacts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_storm_category", "hail_swaths",
        ["storm_id", "hail_size_category"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_storm_category", "hail_swaths", type_="unique")
