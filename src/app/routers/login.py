from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from app.db import get_db
from app.routers.legacy import mark_legacy_route_used
from app.services.login import logueo
from app.schemas.login import LoginRequest , LoginResponse
import traceback

router = APIRouter()


@router.post("/post", response_model=LoginResponse)
def login_auth(
    request: LoginRequest,
    raw_request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    mark_legacy_route_used(
        response=response,
        request=raw_request,
        successor_path="/auth/login",
        legacy_route="/login/post",
    )
    try:
        resultado_logueo = logueo(db,request)
        if not resultado_logueo:
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        return resultado_logueo
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al loguearse")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
