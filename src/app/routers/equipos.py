from fastapi import APIRouter, Depends, exceptions
from sqlalchemy.orm import Session
from app.db import get_db
from app.services.equipos import create_equipo
from app.schemas.equipos import EquipoCreate, EquipoResponse
import traceback

router = APIRouter()

@router.post("/post", response_model=EquipoResponse)
def create_equipo_endpoint(equipo: EquipoCreate, db: Session = Depends(get_db)):
    try:
        db_equipo = create_equipo(db, equipo)
        if db_equipo is None:
            raise exceptions.HTTPException(status_code=404, detail="Modelo de equipo no encontrado")
        return db_equipo
    except ValueError as e:
        raise exceptions.HTTPException(status_code=400, detail=str(e))
    except exceptions.HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise exceptions.HTTPException(status_code=500, detail="Error al crear el equipo")
