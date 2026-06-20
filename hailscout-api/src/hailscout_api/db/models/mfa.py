"""Tables backing SMS 2FA (LOGIN-STANDARD §4 — text codes only, no apps).

``user_mfa_secrets``    one row per enrolled user: the verified phone (E.164).
                        (``recovery_codes_encrypted`` is a retired, dormant
                        column — never read or written; kept for data safety.)
``mfa_sms_challenges``  short-lived one-time texted codes. The raw 6-digit
                        code is never stored — only its HMAC-SHA256; 5-minute
                        expiry, 5-attempt cap, single-use.
``trusted_devices``     "remember this device for 90 days" trust tokens,
                        stored as SHA-256 hashes (raw lives only on the
                        device). Revoked on MFA-disable and password reset.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from hailscout_api.db.base import Base, created_at_column, updated_at_column


class UserMfaSecret(Base):
    """Per-user SMS 2FA enrollment: the verified second-factor phone."""

    __tablename__ = "user_mfa_secrets"

    user_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    # The verified second-factor phone, E.164 (e.g. "+15551234567").
    phone_e164: Mapped[str | None] = mapped_column(String(20))
    # RETIRED, dormant column (recovery codes removed — LOGIN-STANDARD §4). No
    # code reads or writes it; new enrollments leave it NULL. Retained (not
    # dropped) so existing rows keep their data — see models docstring.
    recovery_codes_encrypted: Mapped[str | None] = mapped_column(Text)
    enabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()

    def __repr__(self) -> str:
        return f"<UserMfaSecret(user_id={self.user_id}, enabled_at={self.enabled_at})>"


class MfaSmsChallenge(Base):
    """A single texted code: HMAC of the code, never the code itself."""

    __tablename__ = "mfa_sms_challenges"
    __table_args__ = (
        Index("ix_mfa_sms_challenges_user_purpose", "user_id", "purpose"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    # 'enroll' (verifying a new phone) or 'login' (second factor at sign-in).
    purpose: Mapped[str] = mapped_column(String(16), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    target_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    attempts: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, server_default="0"
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at_column()

    def __repr__(self) -> str:
        return f"<MfaSmsChallenge(id={self.id}, purpose={self.purpose})>"


class TrustedDevice(Base):
    """A device that passed 2FA and may skip the texted code for 90 days."""

    __tablename__ = "trusted_devices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    # Best-effort device description (from User-Agent) for the settings UI.
    label: Mapped[str | None] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at_column()

    def __repr__(self) -> str:
        return f"<TrustedDevice(id={self.id}, user_id={self.user_id})>"
