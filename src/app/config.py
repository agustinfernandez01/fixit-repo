from pathlib import Path
import warnings

from dotenv import load_dotenv
import os

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
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

# Si DATABASE_URL está definida, se usa. Si no, se construye desde variables.
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "1452")
    DB_NAME = os.getenv("DB_NAME", "fixitdb")
    DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
