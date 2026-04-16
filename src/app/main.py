import logging

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from app.config import UPLOAD_DIR
from app.db import Base, engine
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
def crear_tablas_si_hay_db():
    """Crea las tablas solo si la conexión a MySQL funciona (ej. DB_PASSWORD en .env)."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    try:
        Base.metadata.create_all(bind=engine)
        # Mini-migración defensiva: agrega columna foto_url si falta.
        try:
            insp = inspect(engine)
            cols = {c.get("name") for c in insp.get_columns("equipos")}
            if "foto_url" not in cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE equipos ADD COLUMN foto_url VARCHAR(255) NULL"))
                logger.info("Migración aplicada: equipos.foto_url")

            # Canje: catálogo propio de modelos + FK lógica de cotizaciones.
            tablas = set(insp.get_table_names())
            if "modelos_canje" in tablas:
                cols_modelos_canje = {
                    c.get("name") for c in insp.get_columns("modelos_canje")
                }
                if "foto_url" not in cols_modelos_canje:
                    with engine.begin() as conn:
                        conn.execute(
                            text("ALTER TABLE modelos_canje ADD COLUMN foto_url VARCHAR(255) NULL")
                        )
                    logger.info("Migración aplicada: modelos_canje.foto_url")

            if "cotizaciones_canje" in tablas:
                columnas_cotizaciones = insp.get_columns("cotizaciones_canje")
                cols_cotizaciones = {c.get("name") for c in columnas_cotizaciones}
                if "id_modelo_canje" not in cols_cotizaciones:
                    with engine.begin() as conn:
                        conn.execute(
                            text(
                                "ALTER TABLE cotizaciones_canje ADD COLUMN id_modelo_canje INT NULL"
                            )
                        )
                    logger.info("Migración aplicada: cotizaciones_canje.id_modelo_canje")

                col_id_modelo = next(
                    (c for c in columnas_cotizaciones if c.get("name") == "id_modelo"),
                    None,
                )
                if col_id_modelo and not col_id_modelo.get("nullable", False):
                    with engine.begin() as conn:
                        conn.execute(
                            text("ALTER TABLE cotizaciones_canje MODIFY id_modelo INT NULL")
                        )
                    logger.info("Migración aplicada: cotizaciones_canje.id_modelo nullable")
        except Exception as e:
            logger.warning("No se pudo verificar/migrar columna equipos.foto_url: %s", e)
        logger.info("Tablas creadas o ya existentes en la base de datos.")
    except Exception as e:
        err = str(e)
        hint = ""
        if "cryptography" in err.lower():
            hint = (
                " Instala el paquete en el mismo Python que usa uvicorn: "
                "`python -m pip install cryptography` (o `pip install -r app/requirements.txt` desde la carpeta `src`)."
            )
        logger.warning(
            "No se pudo conectar a la base de datos. Revisa .env (DB_PASSWORD, DB_NAME). "
            "La API arranca igual; los endpoints que usen DB fallarán hasta que configures MySQL. Error: %s%s",
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
