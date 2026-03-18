from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.services.roles import get_roles
from app.schemas.roles import RolesResponse
import traceback

router = APIRouter()

@router.get("/get", response_model=list[RolesResponse])
def listar_roles(db: Session = Depends(get_db)):
    try:
        return get_roles(db)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al listar roles: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))




