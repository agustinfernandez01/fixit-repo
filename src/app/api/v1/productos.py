from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.productos import (
    ProductoDetalleResponse,
    ProductoResponse,
    ProductoTiendaAgrupadoResponse,
)
from app.services.productos import get_catalogo_tienda_agrupado, get_producto_detalle, get_productos

router = APIRouter()


@router.get("/catalogo/tienda", response_model=list[ProductoTiendaAgrupadoResponse])
def catalogo_tienda_agrupado_v1(db: Session = Depends(get_db)):
    """Catálogo de tienda: un renglón por modelo (equipos nuevos), con variantes por unidad."""
    try:
        return get_catalogo_tienda_agrupado(db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=list[ProductoResponse])
def listar_productos_v1(db: Session = Depends(get_db)):
    try:
        return get_productos(db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{id_producto}", response_model=ProductoDetalleResponse)
def obtener_producto_detalle_v1(id_producto: int, db: Session = Depends(get_db)):
    try:
        detalle = get_producto_detalle(db, id_producto)
        if not detalle:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        return detalle
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
