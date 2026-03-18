from fastapi import FastAPI
from app.db import Base, engine
from app.routers import roles, usuarios , login

app = FastAPI(title="Fix It API")

Base.metadata.create_all(bind=engine)

app.include_router(roles.router, prefix="/roles", tags=["Roles"])
app.include_router(usuarios.router, prefix="/usuarios", tags=["Usuarios"])
app.include_router(login.router, prefix="/login", tags=["Logueo"])


@app.get("/")
def root():
    return {"message": "API Fix It funcionando"}