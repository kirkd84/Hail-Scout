"""Organization, user, and seat models."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from hailscout_api.db.base import Base, created_at_column, id_column, updated_at_column

if TYPE_CHECKING:
    from hailscout_api.db.models.storm import Storm  # noqa: F401


class Organization(Base):
    """Organization (multi-tenant workspace)."""

    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    plan_tier: Mapped[str] = mapped_column(String(50), default="free", nullable=False)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255))
    # Branding overrides for Hail Impact Reports
    brand_logo_url:     Mapped[str | None] = mapped_column(String(500))
    brand_primary:      Mapped[str | None] = mapped_column(String(16))
    brand_accent:       Mapped[str | None] = mapped_column(String(16))
    brand_company_name: Mapped[str | None] = mapped_column(String(255))
    # Slack incoming webhook (per-org, optional). When set + slack_enabled
    # is true, the alert generator POSTs new matches here.
    slack_webhook_url: Mapped[str | None] = mapped_column(String(512))
    slack_enabled:     Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false"
    )
    # Email alert delivery (per-org). `alert_email_recipients` is a
    # comma-separated list (≤ 8 addresses) — we keep the column flat
    # because per-recipient preferences are not in scope yet.
    alert_emails_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false"
    )
    alert_email_recipients: Mapped[str | None] = mapped_column(String(2048))
    # Org-level default threshold — addresses with their own
    # `alert_threshold_in` override this.
    alert_min_size_in: Mapped[float] = mapped_column(
        Float, nullable=False, server_default="0.75", default=0.75,
    )
    # SMS alert delivery (per-org). Comma-separated phone numbers (≤ 8).
    sms_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false"
    )
    sms_recipients: Mapped[str | None] = mapped_column(String(2048))
    # Web-push alert delivery (per-org toggle). Subscriptions live in
    # push_subscriptions — one per signed-in device.
    push_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false"
    )
    created_at: Mapped[datetime] = created_at_column()

    # Relationships
    users: Mapped[list[User]] = relationship(back_populates="organization")
    seats: Mapped[list[Seat]] = relationship(back_populates="organization")

    def __repr__(self) -> str:
        return f"<Organization(id={self.id}, name={self.name}, plan_tier={self.plan_tier})>"


class User(Base):
    """User. Identity comes from Google/Microsoft OAuth; we mint our own tokens."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(50), default="member", nullable=False)
    # System-level super-admin flag (cross-tenant). Independent of the org-level
    # role field; a super_admin can manage every org regardless of org role.
    is_super_admin: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false"
    )
    # Stable per-identity subject. Holds a ``pending_*`` placeholder (seed) until
    # the first OAuth sign-in links the real provider subject — same reconcile
    # model the Clerk webhook used, now done inline at token exchange.
    auth_subject: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    # Which provider linked the subject: 'google' | 'microsoft' | None.
    auth_provider: Mapped[str | None] = mapped_column(String(32))
    # argon2id hash for email+password sign-in (LOGIN-STANDARD). Null for
    # social-only accounts; set via the password-reset flow (which doubles
    # as set-initial-password for invited users).
    password_hash: Mapped[str | None] = mapped_column(String(255))
    # MFA enrollment grace window for owner/admin roles on PASSWORD logins
    # (LOGIN-STANDARD §4). Set on the first such login after enforcement
    # shipped; once now > this + grace days, password login yields an
    # enroll-scoped token only. Social logins are never gated.
    mfa_grace_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    # Account disable flag. Set by the HR provisioning API (and usable by any
    # future admin tooling). A disabled user is rejected at OAuth exchange and
    # has all refresh sessions revoked, so existing tokens stop working too.
    is_disabled: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false"
    )
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()

    # Relationships
    organization: Mapped[Organization] = relationship(back_populates="users")
    seats: Mapped[list[Seat]] = relationship(back_populates="user")
    sessions: Mapped[list[UserSession]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, org_id={self.org_id})>"


class UserSession(Base):
    """A server-stored, revocable refresh session.

    The raw refresh token is returned to the browser (httpOnly cookie) exactly
    once; we persist only its SHA-256 hash. Sign-out / rotation flip
    ``revoked_at`` so a stolen or logged-out token stops working immediately —
    something a stateless JWT alone can't give us.
    """

    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    refresh_token_hash: Mapped[str] = mapped_column(
        String(128), unique=True, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # When this session CHAIN began. Refresh rotation inserts new rows but
    # carries this anchor forward, so the chain dies SESSION_MAX_DAYS after
    # the original sign-in no matter how active it is (LOGIN-STANDARD §5).
    # Null on legacy rows → fall back to created_at.
    first_authenticated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    created_at: Mapped[datetime] = created_at_column()
    user_agent: Mapped[str | None] = mapped_column(String(512))
    ip: Mapped[str | None] = mapped_column(String(64))

    # Relationships
    user: Mapped[User] = relationship(back_populates="sessions")

    def __repr__(self) -> str:
        return f"<UserSession(id={self.id}, user_id={self.user_id})>"


class ApiToken(Base):
    """A personal access token for the read-only API.

    We store only the SHA-256 hash of the token; the plaintext (``hsk_…``) is
    shown exactly once at creation. ``scope`` is "read" for now — PATs are
    rejected on any non-GET request at the auth layer.
    """

    __tablename__ = "api_tokens"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    # First chars of the plaintext, kept for display ("hsk_ab12cd…").
    prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    scope: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default="read", default="read"
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at_column()

    def __repr__(self) -> str:
        return f"<ApiToken(id={self.id}, user_id={self.user_id})>"


class Seat(Base):
    """Organizational seat allocation."""

    __tablename__ = "seats"

    id: Mapped[int] = id_column()
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    assigned_at: Mapped[datetime] = created_at_column()

    # Relationships
    organization: Mapped[Organization] = relationship(back_populates="seats")
    user: Mapped[User] = relationship(back_populates="seats")

    def __repr__(self) -> str:
        return f"<Seat(id={self.id}, org_id={self.org_id}, user_id={self.user_id})>"
