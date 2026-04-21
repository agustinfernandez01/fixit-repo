from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.routers.legacy import mark_legacy_route_used
from app.services.refresh_login import refresh_login
from app.schemas.login import LoginResponse
import traceback

router = APIRouter()


@router.post("/post", response_model=LoginResponse)
def refresh_login_auth(
    refresh_token: str,
    raw_request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    mark_legacy_route_used(
        response=response,
        request=raw_request,
        successor_path="/auth/refresh",
        legacy_route="/refresh/post",
    )
    try:
        resultado_refresh = refresh_login(db, refresh_token)
        if not resultado_refresh:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido o error al refrescar el login")
        return resultado_refresh
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al refrescar el login")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))