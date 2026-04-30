"""003 - Simplify canvass models for API persistence.

Revision ID: 003_simplify_canvass
Revises: 002_add_is_super_admin
Create Date: 2026-04-29

The original canvass schema (Month-3 design) coupled markers and monitored
addresses to a `parcels` table that we don't yet have populated, and to a
`storms` table that we don't yet write to from the API. This migration
denormalizes the few fields we actually need on each row so the canvassing
flow works end-to-end before the parcel ingest pipeline ships.

Changes:

monitored_addresses:
- parcel_id        -> nullable
- label            -> nullable (replaced by `address` for free-text rows)
- alert_threshold_in -> nullable, default 0.75
- + lat (Float, NOT NULL)
- + lng (Float, NOT NULL)
- + address (String 500)        — denormalized full text
- + last_storm_at (DateTime nullable)
- + last_storm_size_in (Float nullable)
- + user_id (FK users.id, nullable, indexed)

markers:
- storm_id    -> nullable (already, just confirming)
- parcel_id   -> nullable
- geom_point  -> nullable (existing rows still set, new rows can skip it)
- + lat (Float, nullable)
- + lng (Float, nullable)
- + client_id (String 64, nullable, indexed) — for idempotent upsert
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "003_simplify_canvass"
down_revision = "002_add_is_super_admin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── monitored_addresses ───────────────────────────────────────────
    op.alter_column("monitored_addresses", "parcel_id", nullable=True)
    op.alter_column("monitored_addresses", "label",     nullable=True)
    op.alter_column(
        "monitored_addresses",
        "alert_threshold_in",
        nullable=True,
        server_default=sa.text("0.75"),
    )

    op.add_column("monitored_addresses", sa.Column("lat", sa.Float(), nullable=True))
    op.add_column("monitored_addresses", sa.Column("lng", sa.Float(), nullable=True))
    op.add_column("monitored_addresses", sa.Column("address", sa.String(500), nullable=True))
    op.add_column("monitored_addresses", sa.Column("last_storm_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("monitored_addresses", sa.Column("last_storm_size_in", sa.Float(), nullable=True))
    op.add_column(
        "monitored_addresses",
        sa.Column("user_id", sa.String(255), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("ix_monitored_addresses_user_id", "monitored_addresses", ["user_id"])
    op.create_index("ix_monitored_addresses_lat_lng", "monitored_addresses", ["lat", "lng"])

    # ── markers ────────────────────────────────────────────────────────
    # Make geom_point nullable so we can write rows without PostGIS geometry
    op.alter_column("markers", "geom_point", nullable=True)
    # storm_id / parcel_id were already nullable per the original ORM but
    # confirm in DDL too in case the table was created differently.
    op.alter_column("markers", "storm_id",  nullable=True)
    op.alter_column("markers", "parcel_id", nullable=True)

    op.add_column("markers", sa.Column("lat", sa.Float(), nullable=True))
    op.add_column("markers", sa.Column("lng", sa.Float(), nullable=True))
    op.add_column("markers", sa.Column("client_id", sa.String(64), nullable=True))
    op.create_index("ix_markers_client_id", "markers", ["client_id"])
    op.create_index("ix_markers_lat_lng",   "markers", ["lat", "lng"])


def downgrade() -> None:
    op.drop_index("ix_markers_lat_lng",   table_name="markers")
    op.drop_index("ix_markers_client_id", table_name="markers")
    op.drop_column("markers", "client_id")
    op.drop_column("markers", "lng")
    op.drop_column("markers", "lat")
    op.alter_column("markers", "geom_point", nullable=False)

    op.drop_index("ix_monitored_addresses_lat_lng", table_name="monitored_addresses")
    op.drop_index("ix_monitored_addresses_user_id", table_name="monitored_addresses")
    op.drop_column("monitored_addresses", "user_id")
    op.drop_column("monitored_addresses", "last_storm_size_in")
    op.drop_column("monitored_addresses", "last_storm_at")
    op.drop_column("monitored_addresses", "address")
    op.drop_column("monitored_addresses", "lng")
    op.drop_column("monitored_addresses", "lat")
    op.alter_column(
        "monitored_addresses", "alert_threshold_in",
        nullable=False, server_default=None,
    )
    op.alter_column("monitored_addresses", "label",     nullable=False)
    op.alter_column("monitored_addresses", "parcel_id", nullable=False)
