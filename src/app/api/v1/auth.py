from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.login import LoginRequest, LoginResponse
from app.services.login import logueo
from app.services.logout import logout
from app.services.refresh_login import refresh_login

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login_v1(request: LoginRequest, db: Session = Depends(get_db)):
    try:
        resultado = logueo(db, request)
        if not resultado:
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh", response_model=LoginResponse)
def refresh_v1(refresh_token: str, db: Session = Depends(get_db)):
    try:
        resultado = refresh_login(db, refresh_token)
        if not resultado:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token inválido o error al refrescar el login",
            )
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/logout")
def logout_v1(refresh_token: str, db: Session = Depends(get_db)):
    try:
        return logout(db, refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
