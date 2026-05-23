"""SQLAlchemy engine + session factory."""
from __future__ import annotations
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from hailscout_pipeline.config import settings

# Railway provides DATABASE_URL like postgresql://user:pass@host:5432/db
# but psycopg2 wants postgresql+psycopg2://...
db_url = settings.database_url
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)

engine = create_engine(
    db_url,
    echo=settings.db_echo,
    # Lean per-replica pool so we can scale to many replicas without
    # blowing past Postgres `max_connections` (Railway's managed
    # Postgres default is 100). With pool_size=2 + max_overflow=3 and,
    # say, 16 replicas, peak connections is 16 × 5 = 80 — well inside
    # the budget with headroom for the API service and ad-hoc psql.
    pool_size=2,
    max_overflow=3,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False,
                            expire_on_commit=False)


def get_session() -> Session:
    return SessionLocal()
