import logging

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.config import UPLOAD_DIR
from app.db import engine
from app.routers import roles, usuarios, login, refresh, logout, equipos, productos
import app.models  # noqa: F401 - registra todos los modelos en Base.metadata
from app.api.v1 import api_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Fix It API",
    description="Backend e-commerce celulares. Rutas actuales: mis módulos (inventario equipos, marketplace usados, reparaciones, canje). Auth/catálogo/pedidos los desarrolla el compañero.",
    version="1.0.0",
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


# API v1: inventario, marketplace, reparaciones, canje
app.include_router(api_router, prefix="/api/v1")
app.include_router(roles.router, prefix="/roles", tags=["Roles"])
app.include_router(usuarios.router, prefix="/usuarios", tags=["Usuarios"])
app.include_router(login.router, prefix="/login", tags=["Logueo"])
app.include_router(refresh.router, prefix="/refresh", tags=["Refresh"])
app.include_router(logout.router, prefix="/logout", tags=["Logout"])
app.include_router(equipos.router, prefix="/equipos", tags=["Equipos"])
app.include_router(productos.router, prefix="/productos", tags=["Productos"])

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploads",
)


@app.get("/")
def root():
    return {"message": "API Fix It funcionando", "docs": "/docs"}
