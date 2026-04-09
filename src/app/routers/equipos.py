from fastapi import APIRouter, Depends, exceptions, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.services.equipos import get_equipos
from app.schemas.equipos import EquipoResponse
import traceback

router = APIRouter()


#GET - Listar equipos
@router.get("/get", response_model=list[EquipoResponse])
def listar_equipos(db: Session = Depends(get_db)):
    try:
        return get_equipos(db)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al listar equipos: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

#POST - Crear equipo (legacy deprecado)
@router.post("/post", deprecated=True)
def create_equipo_endpoint():
    raise exceptions.HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "Endpoint deprecado: usa POST /api/v1/inventario/equipos "
            "como flujo oficial de alta de equipos."
        ),
    )
