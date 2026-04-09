from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.productos import get_productos, get_producto_detalle
from app.schemas.productos import ProductoResponse, ProductoDetalleResponse
import traceback

router = APIRouter()

#GET - Listar productos
@router.get("/get", response_model=list[ProductoResponse])
def listar_productos(db: Session = Depends(get_db)):
    try:
        return get_productos(db)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al listar productos: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/get/{id_producto}", response_model=ProductoDetalleResponse)
def obtener_producto_detalle(id_producto: int, db: Session = Depends(get_db)):
    try:
        detalle = get_producto_detalle(db, id_producto)
        if not detalle:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        return detalle
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al obtener detalle del producto {id_producto}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))