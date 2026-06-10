"""021 - Email+password sign-in: users.password_hash, login_attempts, user_tokens.

Revision ID: 021_password_auth
Revises: 020_api_tokens
Create Date: 2026-06-10

LOGIN-STANDARD additions: nullable argon2id ``password_hash`` on users
(social-only accounts keep NULL; the password-reset flow doubles as
set-initial-password for invited users), a durable email-keyed lockout
counter, and hashed password-reset tokens.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "021_password_auth"
down_revision = "020_api_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String(length=255), nullable=True),
    )
    op.create_table(
        "login_attempts",
        sa.Column("email", sa.String(length=255), primary_key=True),
        sa.Column(
            "failed_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_failed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "user_tokens",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=255),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_user_tokens_user_id", "user_tokens", ["user_id"])
    op.create_unique_constraint("uq_user_tokens_token_hash", "user_tokens", ["token_hash"])


def downgrade() -> None:
    op.drop_table("user_tokens")
    op.drop_table("login_attempts")
    op.drop_column("users", "password_hash")
