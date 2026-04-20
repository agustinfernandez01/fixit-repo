from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import DATABASE_URL
import os

# pool_pre_ping: reconecta si Render/Postgres cierra conexiones idle
SQL_ECHO = os.getenv("SQL_ECHO", "false").strip().lower() in {"1", "true", "yes", "on"}
_engine_kwargs = {"echo": SQL_ECHO, "pool_pre_ping": True}
if "postgresql" in (DATABASE_URL or ""):
    _engine_kwargs.setdefault("pool_size", 5)
    _engine_kwargs.setdefault("max_overflow", 10)

engine = create_engine(DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()