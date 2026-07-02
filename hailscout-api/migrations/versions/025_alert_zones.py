"""Alert zones (Phase 33 — storm alarms) + us_states matching table.

* alert_zones — user-defined alarm areas (radius / states / nationwide)
  with per-zone hail + wind thresholds.
* storm_alerts — monitored_address_id becomes NULLABLE (zone alerts have
  no address) and gains alert_zone_id / zone_name / kind.
* us_states — 52 simplified state polygons (public-domain Census-derived
  GeoJSON bundled at migrations/data/us_states.json) so "all of Colorado"
  zones match via ST_Contains on the storm centroid.

Revision ID: 025_alert_zones
Revises: 024_mobile_push_tokens
"""
from __future__ import annotations

import json
import os

import sqlalchemy as sa
from alembic import op

revision = "025_alert_zones"
down_revision = "024_mobile_push_tokens"
branch_labels = None
depends_on = None

_DATA = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "us_states.json",
)


def upgrade() -> None:
    # ── alert_zones ──────────────────────────────────────────────────
    op.create_table(
        "alert_zones",
        sa.Column("id", sa.String(255), primary_key=True),
        sa.Column(
            "org_id",
            sa.String(255),
            sa.ForeignKey("organizations.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.String(255),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("center_lat", sa.Float, nullable=True),
        sa.Column("center_lng", sa.Float, nullable=True),
        sa.Column("radius_mi", sa.Float, nullable=True),
        sa.Column("states", sa.Text, nullable=True),
        sa.Column("min_hail_in", sa.Float, nullable=True),
        sa.Column("min_wind_mph", sa.Float, nullable=True),
        sa.Column(
            "enabled", sa.Boolean, nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # ── storm_alerts: zone provenance ────────────────────────────────
    op.alter_column(
        "storm_alerts",
        "monitored_address_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.add_column(
        "storm_alerts",
        sa.Column(
            "alert_zone_id",
            sa.String(255),
            sa.ForeignKey("alert_zones.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "storm_alerts", sa.Column("zone_name", sa.String(255), nullable=True)
    )
    op.add_column(
        "storm_alerts",
        sa.Column(
            "kind", sa.String(20), nullable=False, server_default="address"
        ),
    )
    op.create_index(
        "ix_storm_alerts_zone_storm",
        "storm_alerts",
        ["alert_zone_id", "storm_id"],
    )

    # ── us_states polygons ───────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS us_states (
            code VARCHAR(2) PRIMARY KEY,
            name VARCHAR(64) NOT NULL,
            geom geometry(MULTIPOLYGON, 4326) NOT NULL
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_us_states_geom "
        "ON us_states USING GIST (geom)"
    )

    conn = op.get_bind()
    with open(_DATA, encoding="utf-8") as f:
        fc = json.load(f)
    stmt = sa.text(
        """
        INSERT INTO us_states (code, name, geom)
        VALUES (:code, :name,
                ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:gj), 4326)))
        ON CONFLICT (code) DO NOTHING
        """
    )
    for feat in fc["features"]:
        props = feat["properties"]
        conn.execute(
            stmt,
            {
                "code": props["code"],
                "name": props["name"],
                "gj": json.dumps(feat["geometry"]),
            },
        )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS us_states")
    op.drop_index("ix_storm_alerts_zone_storm", table_name="storm_alerts")
    op.drop_column("storm_alerts", "kind")
    op.drop_column("storm_alerts", "zone_name")
    op.drop_column("storm_alerts", "alert_zone_id")
    op.alter_column(
        "storm_alerts",
        "monitored_address_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.drop_table("alert_zones")
