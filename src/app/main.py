import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.config import UPLOAD_DIR
from app.db import engine
import app.models  # noqa: F401 - registra todos los modelos en Base.metadata
from app.api.v1 import api_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Fix It API",
    description="Backend e-commerce celulares. Rutas actuales: mis módulos (inventario equipos, marketplace usados, reparaciones, canje). Auth/catálogo/pedidos los desarrolla el compañero.",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# En producción, leemos los orígenes permitidos desde la variable de entorno
# ALLOWED_ORIGINS (separados por coma). Si no está definida, permitimos todo
# (útil en desarrollo local con Docker).
_raw = os.getenv("ALLOWED_ORIGINS", "*")
if _raw.strip() == "*":
    allow_origins = ["*"]
    allow_credentials = False   # wildcard + credentials=True es inválido (HTTP 400)
else:
    allow_origins = [o.strip() for o in _raw.split(",") if o.strip()]
    allow_credentials = True    # origen específico → credenciales permitidas

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def verificar_db_en_startup():
    """
    Verifica conectividad a la DB en startup.
    El esquema se gestiona EXCLUSIVAMENTE con Alembic (sin create_all ni parches runtime).
    """
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Conexión a la base de datos OK.")
    except Exception as e:
        err = str(e)
        hint = ""
        if "cryptography" in err.lower():
            hint = (
                " Instala el paquete en el mismo Python que usa uvicorn: "
                "`python -m pip install cryptography` (o `pip install -r app/requirements.txt` desde la carpeta `src`)."
            )
        logger.warning(
            "No se pudo conectar a la base de datos. Revisa .env (DATABASE_URL o PG_* para Postgres; DB_* para MySQL). "
            "La API arranca igual; los endpoints que usen DB fallarán hasta que configures la DB. "
            "Recuerda aplicar migraciones con `alembic upgrade head`. Error: %s%s",
            e,
            hint,
        )


# API v1: auth, inventario, productos, carrito, marketplace, reparaciones, canje, accesorios
app.include_router(api_router, prefix="/api/v1")

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploads",
)


@app.get("/")
def root():
    return {"message": "API Fix It funcionando", "docs": "/docs"}
