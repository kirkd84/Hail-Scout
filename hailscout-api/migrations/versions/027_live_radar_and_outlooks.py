"""Live radar frames + SPC hail-probability outlooks.

Two independent features share this revision so the chain stays linear:

1. ``radar_frames`` — rendered MRMS raster frames (POSH "hail likely",
   MESH "hail size now", and composite reflectivity for context). Frames are
   small PNGs with alpha; most of a CONUS grid is empty on a quiet day, so
   they compress hard. Stored in Postgres rather than object storage because
   there's no bucket wired up and the retention window is only a few hours.

2. ``hail_outlooks`` — SPC day-1/2/3 hail probability polygons (the feed
   behind "35% hail risk in your area today"), plus ``hail_outlook_alerts``
   to guarantee one notification per zone per outlook period.

Revision ID: 027_live_radar_and_outlooks
Revises: 026_user_names
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry

revision = "027_live_radar_and_outlooks"
down_revision = "026_user_names"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "radar_frames",
        sa.Column("id", sa.String(255), primary_key=True),
        # posh | mesh | reflectivity
        sa.Column("product", sa.String(32), nullable=False),
        sa.Column("valid_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("min_lat", sa.Float, nullable=False),
        sa.Column("min_lng", sa.Float, nullable=False),
        sa.Column("max_lat", sa.Float, nullable=False),
        sa.Column("max_lng", sa.Float, nullable=False),
        sa.Column("width", sa.Integer, nullable=False),
        sa.Column("height", sa.Integer, nullable=False),
        # Peak value in the frame — lets the client label "up to 2.00in"
        # without decoding the image.
        sa.Column("peak_value", sa.Float, nullable=True),
        sa.Column("png", sa.LargeBinary, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("product", "valid_time", name="uq_radar_frame_product_time"),
    )
    # The hot query is "newest N frames of one product".
    op.create_index(
        "ix_radar_frames_product_time",
        "radar_frames",
        ["product", sa.text("valid_time DESC")],
    )

    op.create_table(
        "hail_outlooks",
        sa.Column("id", sa.String(255), primary_key=True),
        sa.Column("day", sa.Integer, nullable=False),  # 1 | 2 | 3
        sa.Column("kind", sa.String(16), nullable=False),  # hail | sighail
        # 0.05, 0.15, 0.30, 0.45, 0.60 … (sighail is a flat 0.10 hatched area)
        sa.Column("probability", sa.Float, nullable=False),
        sa.Column("label", sa.String(64), nullable=True),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("geom", Geometry("MULTIPOLYGON", srid=4326), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "day", "kind", "probability", "valid_from", name="uq_hail_outlook_slice"
        ),
    )
    op.create_index("ix_hail_outlooks_valid", "hail_outlooks", ["valid_from", "valid_to"])
    op.create_index(
        "ix_hail_outlooks_geom", "hail_outlooks", ["geom"], postgresql_using="gist"
    )

    op.create_table(
        "hail_outlook_alerts",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("org_id", sa.String(255), nullable=False, index=True),
        sa.Column("zone_id", sa.String(255), nullable=False, index=True),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("day", sa.Integer, nullable=False),
        sa.Column("probability", sa.Float, nullable=False),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        # One notification per zone per outlook period per hazard — this is
        # what stops a re-run of the job re-notifying the whole customer base.
        sa.UniqueConstraint(
            "zone_id", "kind", "valid_from", name="uq_hail_outlook_alert_zone_period"
        ),
    )


def downgrade() -> None:
    op.drop_table("hail_outlook_alerts")
    op.drop_index("ix_hail_outlooks_geom", table_name="hail_outlooks")
    op.drop_index("ix_hail_outlooks_valid", table_name="hail_outlooks")
    op.drop_table("hail_outlooks")
    op.drop_index("ix_radar_frames_product_time", table_name="radar_frames")
    op.drop_table("radar_frames")
