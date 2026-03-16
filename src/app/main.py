from fastapi import FastAPI
from app.db import Base, engine
from app.routers import usuarios, productos, reparaciones, publicaciones

app = FastAPI(title="Fix It API")

Base.metadata.create_all(bind=engine)

app.include_router(usuarios.router, prefix="/usuarios", tags=["Usuarios"])
app.include_router(productos.router, prefix="/productos", tags=["Productos"])
app.include_router(reparaciones.router, prefix="/reparaciones", tags=["Reparaciones"])
app.include_router(publicaciones.router, prefix="/publicaciones", tags=["Publicaciones"])


@app.get("/")
def root():
    return {"message": "API Fix It funcionando"}