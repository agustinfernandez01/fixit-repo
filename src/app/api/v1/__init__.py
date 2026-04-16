# API v1 - routers por módulo
from fastapi import APIRouter
from app.api.v1 import accesorios, canje, carrito, inventario, marketplace, reparaciones

api_router = APIRouter()

api_router.include_router(carrito.router, prefix="/carrito", tags=["Carrito"])
api_router.include_router(inventario.router, prefix="/inventario", tags=["Inventario"])
api_router.include_router(accesorios.router, prefix="/accesorios", tags=["Accesorios"])
api_router.include_router(marketplace.router, prefix="/marketplace", tags=["Marketplace usados"])
api_router.include_router(reparaciones.router, prefix="/reparaciones", tags=["Reparaciones"])
api_router.include_router(canje.router, prefix="/canje", tags=["Canje"])
