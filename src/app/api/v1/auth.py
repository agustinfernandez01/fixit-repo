from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps.auth import get_optional_user_id_from_access_token
from app.db import get_db
from app.schemas.login import LoginRequest, LoginResponse
from app.schemas.usuarios import UsuarioPerfilResponse
from app.models.roles import Rol
from app.models.usuarios import Usuario
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


@router.get("/me", response_model=UsuarioPerfilResponse)
def me_v1(
    db: Session = Depends(get_db),
    id_usuario: int | None = Depends(get_optional_user_id_from_access_token),
):
    if id_usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Debes iniciar sesión.",
        )

    try:
        usuario = (
            db.query(Usuario, Rol.nombre.label("rol_nombre"))
            .join(Rol, Usuario.id_rol == Rol.id)
            .filter(Usuario.id == id_usuario)
            .first()
        )
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        user, rol_nombre = usuario
        return {
            "id": user.id,
            "nombre": user.nombre,
            "apellido": user.apellido,
            "email": user.email,
            "telefono": user.telefono,
            "id_rol": user.id_rol,
            "rol_nombre": rol_nombre,
            "activo": True,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
