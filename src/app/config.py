from pathlib import Path
import warnings
from urllib.parse import quote_plus, urlparse, urlunparse

from dotenv import load_dotenv
import os

APP_DIR = Path(__file__).resolve().parent
SRC_DIR = APP_DIR.parent

load_dotenv(SRC_DIR / ".env")
load_dotenv(APP_DIR / ".env")

BASE_DIR = APP_DIR
UPLOAD_DIR = BASE_DIR / "uploads"

DEFAULT_DEV_SECRET_KEY = "dev-secret-change-in-production-please-override-this-key-2026"
SECRET_KEY = os.getenv("SECRET_KEY", DEFAULT_DEV_SECRET_KEY)
if len(SECRET_KEY) < 32:
    warnings.warn(
        "SECRET_KEY es demasiado corta (<32 chars). Defini una clave mas robusta en .env.",
        RuntimeWarning,
        stacklevel=1,
    )
WHATSAPP_CHECKOUT_PHONE = os.getenv("WHATSAPP_CHECKOUT_PHONE", "5493816226300")


def _normalize_postgres_url(url: str) -> str:
    """Render/Postgres: dialecto + driver para SQLAlchemy; SSL en conexiones externas."""
    u = url.strip()
    if u.startswith("postgres://"):
        u = u.replace("postgres://", "postgresql+psycopg2://", 1)
    elif u.startswith("postgresql://"):
        u = u.replace("postgresql://", "postgresql+psycopg2://", 1)
    parsed = urlparse(u)
    host = (parsed.hostname or "").lower()
    if "render.com" in host and "sslmode" not in (parsed.query or ""):
        q = parsed.query
        extra = "sslmode=require"
        new_query = f"{q}&{extra}" if q else extra
        u = urlunparse(parsed._replace(query=new_query))
    return u


def _build_postgres_url_from_parts() -> str | None:
    host = (os.getenv("PG_HOST") or "").strip()
    port = (os.getenv("PG_PORT") or "5432").strip()
    user = (os.getenv("PG_USER") or "").strip()
    password = (os.getenv("PG_PASSWORD") or "").strip()
    name = (os.getenv("PG_NAME") or os.getenv("PG_DATABASE") or "").strip()
    if not all([host, user, password, name]):
        return None
    user_q = quote_plus(user)
    pass_q = quote_plus(password)
    base = f"postgresql+psycopg2://{user_q}:{pass_q}@{host}:{port}/{name}"
    if "render.com" in host.lower():
        base = f"{base}?sslmode=require"
    return base


# Prioridad: DATABASE_URL → PG_* (Postgres) → MySQL local (variables DB_*)
DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()
if DATABASE_URL:
    if DATABASE_URL.strip().startswith(("postgres://", "postgresql://", "postgresql+psycopg2://")):
        DATABASE_URL = _normalize_postgres_url(DATABASE_URL)
elif _build_postgres_url_from_parts():
    DATABASE_URL = _build_postgres_url_from_parts()
else:
    DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "1452")
    DB_NAME = os.getenv("DB_NAME", "fixitdb")
    DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Mercado Pago (Checkout Pro / API REST). Ver `app.integrations.mercadopago`.
MERCADOPAGO_ACCESS_TOKEN = (os.getenv("MERCADOPAGO_ACCESS_TOKEN") or "").strip()
MERCADOPAGO_PUBLIC_KEY = (os.getenv("MERCADOPAGO_PUBLIC_KEY") or "").strip()
# URL pública del backend (sin barra final): webhooks y, si aplica, back_urls hacia el front.
APP_PUBLIC_BASE_URL = (os.getenv("APP_PUBLIC_BASE_URL") or "").strip().rstrip("/")

# Cloudflare R2 (almacenamiento de imágenes, compatible con S3).
R2_ENDPOINT_URL = (os.getenv("R2_ENDPOINT_URL") or "").strip()
R2_ACCESS_KEY_ID = (os.getenv("R2_ACCESS_KEY_ID") or "").strip()
R2_SECRET_ACCESS_KEY = (os.getenv("R2_SECRET_ACCESS_KEY") or "").strip()
R2_BUCKET_NAME = (os.getenv("R2_BUCKET_NAME") or "").strip()
R2_PUBLIC_URL = (os.getenv("R2_PUBLIC_URL") or "").strip().rstrip("/")
