"""017 - Replace Clerk identity with first-party auth.

Revision ID: 017_own_auth
Revises: 016_radar_size_at_lsr
Create Date: 2026-06-04

HailScout is now its own identity authority (Google/Microsoft OAuth in the
web tier -> provider id_token -> we verify + mint our own session tokens).

Changes:
* ``users.clerk_user_id`` -> ``users.auth_subject`` (still unique, still the
  per-identity stable id; for our tokens it just holds a placeholder until
  first OAuth login, exactly like the old Clerk reconcile flow).
* new ``users.auth_provider`` column ('google' | 'microsoft' | NULL).
* new ``user_sessions`` table: server-stored, hashed, revocable refresh
  tokens so sign-out and rotation actually invalidate access.

No user rows are dropped — existing (seeded) accounts keep their email and
re-link to a real OAuth subject on first sign-in.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "017_own_auth"
down_revision = "016_radar_size_at_lsr"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename the Clerk subject column -> provider-agnostic auth_subject.
    op.alter_column("users", "clerk_user_id", new_column_name="auth_subject")
    # Which provider minted the linked subject (NULL = not yet linked).
    op.add_column(
        "users",
        sa.Column("auth_provider", sa.String(length=32), nullable=True),
    )

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=255),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        # SHA-256 hex of the opaque refresh token (we never store the raw token).
        sa.Column(
            "refresh_token_hash",
            sa.String(length=128),
            nullable=False,
            unique=True,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("user_sessions")
    op.drop_column("users", "auth_provider")
    op.alter_column("users", "auth_subject", new_column_name="clerk_user_id")
