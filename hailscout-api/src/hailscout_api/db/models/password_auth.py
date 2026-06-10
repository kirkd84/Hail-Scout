"""Tables backing email+password sign-in (LOGIN-STANDARD).

``login_attempts`` is the durable per-account lockout counter — keyed by
email (not user id) so attempts against unknown addresses are throttled
identically, and a process restart doesn't reset an attacker's budget.
``user_tokens`` holds password-reset tokens (stored as SHA-256 hashes).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from hailscout_api.db.base import Base


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    email: Mapped[str] = mapped_column(String(255), primary_key=True)
    failed_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, server_default="0"
    )
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UserToken(Base):
    __tablename__ = "user_tokens"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(255), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    purpose: Mapped[str] = mapped_column(String(32), nullable=False)  # 'password_reset'
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
