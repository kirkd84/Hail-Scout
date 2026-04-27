"""001 - Initial schema with all core tables from PRD §1.6

Revision ID: 001_initial_schema
Revises:
Create Date: 2025-04-24

Creates:
- organizations, users, seats
- storms, hail_swaths, nexrad_frames
- parcels, contacts
- monitored_addresses, markers
- impact_reports, contact_exports, alerts
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable PostGIS extension
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # organizations table
    op.create_table(
        "organizations",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("plan_tier", sa.String(50), nullable=False, server_default="free"),
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # users table
    op.create_table(
        "users",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("org_id", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="member"),
        sa.Column("clerk_user_id", sa.String(255), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.Index("ix_users_org_id", "org_id"),
    )

    # seats table
    op.create_table(
        "seats",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.String(255), nullable=False),
        sa.Column("user_id", sa.String(255), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.Index("ix_seats_org_id", "org_id"),
        sa.Index("ix_seats_user_id", "user_id"),
    )

    # storms table
    op.create_table(
        "storms",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("max_hail_size_in", sa.Float(), nullable=False),
        sa.Column("centroid_geom", Geometry("POINT", srid=4326), nullable=False),
        sa.Column("bbox_geom", Geometry("POLYGON", srid=4326), nullable=False),
        sa.Column("source", sa.String(50), nullable=False, server_default="MESH"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.Index("ix_storms_start_time", "start_time"),
    )

    # hail_swaths table
    op.create_table(
        "hail_swaths",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("storm_id", sa.String(255), nullable=False),
        sa.Column("hail_size_category", sa.String(10), nullable=False),
        sa.Column("geom_multipolygon", Geometry("MULTIPOLYGON", srid=4326), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["storm_id"], ["storms.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.Index("ix_hail_swaths_storm_id", "storm_id"),
        sa.Index("ix_hail_swaths_category", "hail_size_category"),
    )

    # nexrad_frames table
    op.create_table(
        "nexrad_frames",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("storm_id", sa.String(255), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("radar_site", sa.String(10), nullable=False),
        sa.Column("tile_url_pattern", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["storm_id"], ["storms.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.Index("ix_nexrad_frames_storm_id", "storm_id"),
    )

    # parcels table
    op.create_table(
        "parcels",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("source_id", sa.String(255), nullable=False, unique=True),
        sa.Column("geom_polygon", Geometry("POLYGON", srid=4326), nullable=False),
        sa.Column("address", sa.String(255), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("state", sa.String(2), nullable=False),
        sa.Column("zip", sa.String(10), nullable=False),
        sa.Column("owner_name", sa.String(255), nullable=True),
        sa.Column("mailing_address", sa.String(255), nullable=True),
        sa.Column("landuse", sa.String(100), nullable=True),
        sa.Column("building_footprint", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.Index("ix_parcels_address", "address"),
    )

    # contacts table
    op.create_table(
        "contacts",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("parcel_id", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("owner_full_name", sa.String(255), nullable=True),
        sa.Column("source", sa.String(50), nullable=False, server_default="cole"),
        sa.Column("last_refreshed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["parcel_id"], ["parcels.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.Index("ix_contacts_parcel_id", "parcel_id"),
    )

    # monitored_addresses table
    op.create_table(
        "monitored_addresses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.String(255), nullable=False),
        sa.Column("parcel_id", sa.String(255), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("alert_threshold_in", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["parcel_id"], ["parcels.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.Index("ix_monitored_addresses_org_id", "org_id"),
    )

    # markers table
    op.create_table(
        "markers",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("user_id", sa.String(255), nullable=False),
        sa.Column("org_id", sa.String(255), nullable=False),
        sa.Column("storm_id", sa.String(255), nullable=True),
        sa.Column("parcel_id", sa.String(255), nullable=True),
        sa.Column("geom_point", Geometry("POINT", srid=4326), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="lead"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("photos", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["storm_id"], ["storms.id"]),
        sa.ForeignKeyConstraint(["parcel_id"], ["parcels.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.Index("ix_markers_user_id", "user_id"),
        sa.Index("ix_markers_org_id", "org_id"),
        sa.Index("ix_markers_storm_id", "storm_id"),
        sa.Index("ix_markers_status", "status"),
    )

    # impact_reports table
    op.create_table(
        "impact_reports",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("org_id", sa.String(255), nullable=False),
        sa.Column("parcel_id", sa.String(255), nullable=False),
        sa.Column("pdf_s3_key", sa.Text(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("branded_logo_url", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["parcel_id"], ["parcels.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.Index("ix_impact_reports_org_id", "org_id"),
    )

    # contact_exports table
    op.create_table(
        "contact_exports",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("org_id", sa.String(255), nullable=False),
        sa.Column("storm_id", sa.String(255), nullable=True),
        sa.Column("polygon_geom", Geometry("POLYGON", srid=4326), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("s3_key", sa.Text(), nullable=False),
        sa.Column("exported_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["storm_id"], ["storms.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.Index("ix_contact_exports_org_id", "org_id"),
    )

    # alerts table
    op.create_table(
        "alerts",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("org_id", sa.String(255), nullable=False),
        sa.Column("storm_id", sa.String(255), nullable=False),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("max_size_in", sa.Float(), nullable=False),
        sa.Column("channel", sa.String(50), nullable=False, server_default="email"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["storm_id"], ["storms.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.Index("ix_alerts_org_id", "org_id"),
    )

    # Create PostGIS spatial indexes
    op.create_index(
        "ix_hail_swaths_geom",
        "hail_swaths",
        ["geom_multipolygon"],
        postgresql_using="gist",
    )
    op.create_index(
        "ix_parcels_geom",
        "parcels",
        ["geom_polygon"],
        postgresql_using="gist",
    )
    op.create_index(
        "ix_storms_centroid",
        "storms",
        ["centroid_geom"],
        postgresql_using="gist",
    )
    op.create_index(
        "ix_storms_bbox",
        "storms",
        ["bbox_geom"],
        postgresql_using="gist",
    )


def downgrade() -> None:
    # Drop all tables in reverse order
    op.drop_table("alerts")
    op.drop_table("contact_exports")
    op.drop_table("impact_reports")
    op.drop_table("markers")
    op.drop_table("monitored_addresses")
    op.drop_table("contacts")
    op.drop_table("parcels")
    op.drop_table("nexrad_frames")
    op.drop_table("hail_swaths")
    op.drop_table("storms")
    op.drop_table("seats")
    op.drop_table("users")
    op.drop_table("organizations")

    op.execute("DROP EXTENSION IF EXISTS postgis CASCADE")
