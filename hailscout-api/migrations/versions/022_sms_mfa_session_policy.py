"""022 - SMS 2FA tables + LOGIN-STANDARD session policy columns.

Revision ID: 022_sms_mfa_session_policy
Revises: 021_password_auth, 021_storms_source_idx
Create Date: 2026-06-10

Also the MERGE point for the two parallel 021 heads (password_auth and
storms_source_idx both revise 020), so ``alembic upgrade head`` resolves
to a single head again.

LOGIN-STANDARD §4 (SMS text codes only — no authenticator apps):
  * ``user_mfa_secrets``    — verified phone (E.164) + AES-256-GCM-encrypted
                              recovery codes, one row per enrolled user.
  * ``mfa_sms_challenges``  — one-time texted codes stored as HMAC-SHA256
                              only (never raw); 5-min TTL, 5-attempt cap.
  * ``trusted_devices``     — "remember this device for 90 days" trust
                              tokens, SHA-256-hashed at rest; revoked on
                              MFA-disable + password reset.
  * ``users.mfa_grace_started_at`` — 7-day enrollment grace anchor for
                              owner/admin password logins.

LOGIN-STANDARD §5 (7-day idle / 90-day absolute session lifetime):
  * ``user_sessions.first_authenticated_at`` — chain anchor carried through
    refresh rotations; nullable, legacy rows fall back to created_at.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "022_sms_mfa_session_policy"
down_revision = ("021_password_auth", "021_storms_source_idx")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("mfa_grace_started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "user_sessions",
        sa.Column(
            "first_authenticated_at", sa.DateTime(timezone=True), nullable=True
        ),
    )

    op.create_table(
        "user_mfa_secrets",
        sa.Column(
            "user_id",
            sa.String(length=255),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("phone_e164", sa.String(length=20), nullable=True),
        sa.Column("recovery_codes_encrypted", sa.Text(), nullable=True),
        sa.Column("enabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "mfa_sms_challenges",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=255),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("purpose", sa.String(length=16), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("target_phone", sa.String(length=20), nullable=False),
        sa.Column(
            "attempts", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_mfa_sms_challenges_user_purpose",
        "mfa_sms_challenges",
        ["user_id", "purpose"],
    )

    op.create_table(
        "trusted_devices",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=255),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_trusted_devices_user_id", "trusted_devices", ["user_id"])
    op.create_unique_constraint(
        "uq_trusted_devices_token_hash", "trusted_devices", ["token_hash"]
    )


def downgrade() -> None:
    op.drop_table("trusted_devices")
    op.drop_index(
        "ix_mfa_sms_challenges_user_purpose", table_name="mfa_sms_challenges"
    )
    op.drop_table("mfa_sms_challenges")
    op.drop_table("user_mfa_secrets")
    op.drop_column("user_sessions", "first_authenticated_at")
    op.drop_column("users", "mfa_grace_started_at")
