"""Database configuration, models, and session management for PostgreSQL/SQLite fallback."""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, DateTime, Float, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

# Setup engine with fallback to SQLite for lightweight execution if Postgres is unavailable
db_url = settings.DATABASE_URL
try:
    if db_url.startswith("postgresql"):
        temp_engine = create_engine(db_url, pool_pre_ping=True)
        with temp_engine.connect() as conn:
            pass
        engine = temp_engine
    else:
        engine = create_engine(db_url, connect_args={"check_same_thread": False} if "sqlite" in db_url else {})
except Exception:
    db_url = "sqlite:///./contextos.db"
    engine = create_engine(db_url, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class LLMRunModel(Base):
    """SQLAlchemy model for llm_runs table."""

    __tablename__ = "llm_runs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_id = Column(String(64), unique=True, index=True, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    task_type = Column(String(32), nullable=False)
    model = Column(String(64), nullable=False)
    prompt_version = Column(String(16), nullable=False, default="v1")
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    latency_ms = Column(Float, nullable=False, default=0.0)
    compression_ratio = Column(Float, nullable=False, default=1.0)
    evaluation_score = Column(Float, nullable=True)
    status = Column(String(16), nullable=False, default="success")
    error_type = Column(String(128), nullable=True)


def init_db():
    """Create database tables if they do not exist."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for obtaining database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
