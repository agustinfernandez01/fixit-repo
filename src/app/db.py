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


def ensure_schema_patches() -> None:
    """
    Parches idempotentes si la DB existe pero Alembic no se aplicó (p. ej. Render sin upgrade).
    Debe alinearse con el modelo SQLAlchemy para evitar errores al leer `equipos`.
    """
    from sqlalchemy import inspect, text

    try:
        insp = inspect(engine)
    except Exception:
        return
    try:
        with engine.begin() as conn:
            tables = set(insp.get_table_names())
            dialect = engine.dialect.name

            if "equipos" in tables:
                cols_eq = {c["name"] for c in insp.get_columns("equipos")}
                if "estado_comercial_previo_reserva" not in cols_eq:
                    if dialect == "postgresql":
                        stmt = text(
                            "ALTER TABLE equipos ADD COLUMN IF NOT EXISTS estado_comercial_previo_reserva VARCHAR(50)"
                        )
                    else:
                        stmt = text("ALTER TABLE equipos ADD COLUMN estado_comercial_previo_reserva VARCHAR(50)")
                    conn.execute(stmt)

            if "productos" in tables:
                cols_prod = {c["name"] for c in insp.get_columns("productos")}
                if "foto_principal_url" not in cols_prod:
                    if dialect == "postgresql":
                        stmt = text(
                            "ALTER TABLE productos ADD COLUMN IF NOT EXISTS foto_principal_url VARCHAR(255)"
                        )
                    else:
                        stmt = text("ALTER TABLE productos ADD COLUMN foto_principal_url VARCHAR(255)")
                    conn.execute(stmt)
    except Exception:
        pass