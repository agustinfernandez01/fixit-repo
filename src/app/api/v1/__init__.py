# API v1 - routers por módulo
from fastapi import APIRouter
from app.api.v1 import inventario, marketplace, reparaciones, canje

api_router = APIRouter()

api_router.include_router(inventario.router, prefix="/inventario", tags=["Inventario"])
api_router.include_router(marketplace.router, prefix="/marketplace", tags=["Marketplace usados"])
api_router.include_router(reparaciones.router, prefix="/reparaciones", tags=["Reparaciones"])
api_router.include_router(canje.router, prefix="/canje", tags=["Canje"])
