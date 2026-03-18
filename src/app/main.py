import logging

from fastapi import FastAPI

from app.db import Base, engine
import app.models  # noqa: F401 - registra todos los modelos en Base.metadata
from app.api.v1 import api_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Fix It API",
    description="Backend e-commerce celulares. Rutas actuales: mis módulos (inventario equipos, marketplace usados, reparaciones, canje). Auth/catálogo/pedidos los desarrolla el compañero.",
    version="1.0.0",
)


@app.on_event("startup")
def crear_tablas_si_hay_db():
    """Crea las tablas solo si la conexión a MySQL funciona (ej. DB_PASSWORD en .env)."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Tablas creadas o ya existentes en la base de datos.")
    except Exception as e:
        logger.warning(
            "No se pudo conectar a la base de datos. Revisa .env (DB_PASSWORD, DB_NAME). "
            "La API arranca igual; los endpoints que usen DB fallarán hasta que configures MySQL. Error: %s",
            e,
        )


# API v1: inventario, marketplace, reparaciones, canje
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "API Fix It funcionando", "docs": "/docs"}
