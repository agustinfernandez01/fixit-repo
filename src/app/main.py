from fastapi import FastAPI
from app.db import Base, engine
from app.routers import roles, usuarios

app = FastAPI(title="Fix It API")

Base.metadata.create_all(bind=engine)

app.include_router(roles.router, prefix="/roles", tags=["Roles"])
app.include_router(usuarios.router, prefix="/usuarios", tags=["Usuarios"])

@app.get("/")
def root():
    return {"message": "API Fix It funcionando"}