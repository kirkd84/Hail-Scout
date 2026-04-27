"""Initial schema: storms and hail_swaths tables with PostGIS geometry.

Revision ID: 001_initial_schema
Revises:
Create Date: 2024-04-24

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create initial schema with PostGIS tables."""
    # Enable PostGIS extension
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # storms table
    op.create_table(
        "storms",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")
        ),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("max_hail_size_in", sa.Float, nullable=True),
        sa.Column(
            "centroid_geom",
            postgresql.UUID(as_uuid=True),  # Placeholder for now; use geoalchemy2 in ORM
            nullable=False,
        ),
        sa.Column(
            "bbox_geom",
            postgresql.UUID(as_uuid=True),  # Placeholder for now
            nullable=False,
        ),
        sa.Column("source", sa.String(50), nullable=False, server_default="MRMS"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # hail_swaths table
    op.create_table(
        "hail_swaths",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")
        ),
        sa.Column("storm_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("storms.id"), nullable=False),
        sa.Column("hail_size_category", sa.String(10), nullable=False),
        sa.Column(
            "geom_multipolygon",
            postgresql.UUID(as_uuid=True),  # Placeholder for now
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("storm_id", "hail_size_category", name="uq_storm_category"),
    )

    # Indexes
    op.create_index("ix_storms_start_time", "storms", ["start_time"])
    op.create_index("ix_hail_swaths_storm_id", "hail_swaths", ["storm_id"])
    op.create_index("ix_hail_swaths_category", "hail_swaths", ["hail_size_category"])


def downgrade() -> None:
    """Drop initial schema."""
    op.drop_index("ix_hail_swaths_category")
    op.drop_index("ix_hail_swaths_storm_id")
    op.drop_index("ix_storms_start_time")
    op.drop_table("hail_swaths")
    op.drop_table("storms")
