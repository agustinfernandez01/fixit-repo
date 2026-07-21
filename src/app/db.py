import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import DATABASE_URL

SQL_ECHO = os.getenv("SQL_ECHO", "false").strip().lower() in {"1", "true", "yes", "on"}

# pool_pre_ping: reconecta si Render/Postgres cierra conexiones idle.
# pool_recycle: descarta conexiones antes de que el proveedor las corte por su cuenta.
_engine_kwargs: dict = {
    "echo": SQL_ECHO,
    "pool_pre_ping": True,
    "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "1800")),
}

_es_postgres = "postgresql" in (DATABASE_URL or "")

if _es_postgres:
    # Con un pooler en modo transacción (pgBouncer / Supabase :6543) un pool grande
    # del lado de la app es contraproducente: el pooler ya multiplexa. Por eso el
    # tamaño se configura por env y se baja el default cuando detectamos el pooler.
    _usa_pooler = ":6543" in (DATABASE_URL or "") or "pooler" in (DATABASE_URL or "")
    _default_pool = 2 if _usa_pooler else 5
    _default_overflow = 3 if _usa_pooler else 10

    _engine_kwargs["pool_size"] = int(os.getenv("DB_POOL_SIZE", str(_default_pool)))
    _engine_kwargs["max_overflow"] = int(os.getenv("DB_MAX_OVERFLOW", str(_default_overflow)))
    _engine_kwargs["pool_timeout"] = int(os.getenv("DB_POOL_TIMEOUT", "10"))
    # Sin connect_timeout, un Postgres inalcanzable cuelga el worker hasta el TCP timeout del SO.
    _engine_kwargs["connect_args"] = {
        "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", "10")),
        "application_name": "fixit-api",
    }

engine = create_engine(DATABASE_URL, **_engine_kwargs)

# expire_on_commit=False: por defecto cada commit() expira todos los objetos de la
# sesión, y el siguiente acceso a un atributo dispara un SELECT de refresh. Con ~60
# pares commit()/refresh() en el código eso son decenas de queries evitables.
# Los `db.refresh(obj)` explícitos siguen funcionando igual.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
