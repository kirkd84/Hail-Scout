"""Organization, user, and seat models."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from hailscout_api.db.base import Base, created_at_column, id_column, updated_at_column

if TYPE_CHECKING:
    from hailscout_api.db.models.storm import Storm


class Organization(Base):
    """Organization (multi-tenant workspace)."""

    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    plan_tier: Mapped[str] = mapped_column(String(50), default="free", nullable=False)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = created_at_column

    # Relationships
    users: Mapped[list[User]] = relationship(back_populates="organization")
    seats: Mapped[list[Seat]] = relationship(back_populates="organization")

    def __repr__(self) -> str:
        return f"<Organization(id={self.id}, name={self.name}, plan_tier={self.plan_tier})>"


class User(Base):
    """User (Clerk-synced)."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(50), default="member", nullable=False)
    clerk_user_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime] = created_at_column
    updated_at: Mapped[datetime] = updated_at_column

    # Relationships
    organization: Mapped[Organization] = relationship(back_populates="users")
    seats: Mapped[list[Seat]] = relationship(back_populates="user")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, org_id={self.org_id})>"


class Seat(Base):
    """Organizational seat allocation."""

    __tablename__ = "seats"

    id: Mapped[int] = id_column
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    assigned_at: Mapped[datetime] = created_at_column

    # Relationships
    organization: Mapped[Organization] = relationship(back_populates="seats")
    user: Mapped[User] = relationship(back_populates="seats")

    def __repr__(self) -> str:
        return f"<Seat(id={self.id}, org_id={self.org_id}, user_id={self.user_id})>"
