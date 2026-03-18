from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.services.login import logueo
from app.schemas.login import LoginRequest , LoginResponse

router = APIRouter

@router.post("/post", response_model=LoginResponse)
def login_auth(db: Session , request: LoginRequest):
    try:
        resultado_logueo = logueo(db,request)
        if not resultado_logueo:
            raise HTTPException("Crendenciales invalidas o error al loguearse")
        return resultado_logueo
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al loguearse")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
