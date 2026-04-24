from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import bcrypt

from app.deps.auth import get_optional_user_id_from_access_token
from app.db import get_db
from app.schemas.login import LoginRequest, LoginResponse, RegisterRequest, RegisterResponse
from app.schemas.usuarios import UsuarioPerfilResponse
from app.models.roles import Rol
from app.models.usuarios import Usuario
from app.services.login import logueo
from app.services.logout import logout
from app.services.refresh_login import refresh_login

router = APIRouter()


def _hash_password(plain: str) -> str:
    h = bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt())
    return h.decode("utf-8") if isinstance(h, bytes) else h


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register_v1(request: RegisterRequest, db: Session = Depends(get_db)):
    nombre = request.nombre.strip()
    apellido = request.apellido.strip()
    email = request.email.strip().lower()
    telefono = request.telefono.strip()
    password = request.password.strip()

    if not nombre or not apellido or not email or not telefono or not password:
        raise HTTPException(status_code=400, detail="Todos los campos son obligatorios.")

    existente = db.query(Usuario).filter(Usuario.email == email).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe una cuenta con ese email.")

    rol_cliente = (
        db.query(Rol)
        .filter(Rol.nombre.ilike("%cliente%"))
        .order_by(Rol.id.asc())
        .first()
    )
    if not rol_cliente:
        rol_cliente = db.query(Rol).filter(Rol.nombre.ilike("%user%")).order_by(Rol.id.asc()).first()
    if not rol_cliente:
        rol_cliente = db.query(Rol).order_by(Rol.id.asc()).first()
    if not rol_cliente:
        raise HTTPException(status_code=500, detail="No hay roles configurados para registrar usuarios.")

    nuevo = Usuario(
        nombre=nombre,
        apellido=apellido,
        email=email,
        telefono=telefono,
        password_hash=_hash_password(password),
        id_rol=rol_cliente.id,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return {
        "id_usuario": nuevo.id,
        "nombre": nuevo.nombre,
        "apellido": nuevo.apellido,
        "email": nuevo.email,
        "telefono": nuevo.telefono,
    }


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
