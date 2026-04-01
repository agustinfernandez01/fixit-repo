from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.productos import get_productos
from app.schemas.productos import ProductoResponse
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