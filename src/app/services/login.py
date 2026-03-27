import uuid
from sqlalchemy.orm import Session
from app.models.sesiones_login import SesionesLogin as model_sesiones
from app.models.usuarios import Usuario as model_usuarios
from app.schemas.login import LoginRequest, LoginResponse
import bcrypt
from datetime import datetime, timedelta, timezone
from app.config import SECRET_KEY
from app.services.tokens import crear_access_token, crear_refresh_token, hash_token , verficar_access_token, verificar_refresh_token , verify_hashed_token

ACCESS_TOKEN_EXPIRE_MINUTES=30
ALGORITHM="HS256"
REFRESH_TOKEN_EXPIRE_DAYS=7

def logueo(db: Session, request: LoginRequest) -> LoginResponse:
    # 1) Buscar usuario
    usuario = db.query(model_usuarios).filter(
        model_usuarios.email == request.email
    ).first()

    if not usuario:
        raise ValueError("Credenciales inválidas")

    # 2) Verificar contraseña
    if not bcrypt.checkpw(
        request.password.encode("utf-8"),
        usuario.password_hash.encode("utf-8")
    ):
        raise ValueError("Credenciales inválidas")

    # 3) Crear identificador de sesión
    session_id = str(uuid.uuid4())

    # 4) Definir expiración de la sesión / refresh token
    ahora = datetime.now(timezone.utc)
    fecha_expiracion = ahora + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    # 5) Crear refresh token incluyendo session_id
    refresh_token = crear_refresh_token(
        usuario=usuario,
        session_id=session_id
    )

    # 6) Hashear el refresh token para guardarlo en DB
    refresh_token_hash = hash_token(refresh_token)

    # 7) Guardar la sesión en la base
    nueva_sesion = model_sesiones(
        id_sesion=session_id,
        id_usuario=usuario.id_usuario,
        refresh_token_hash=refresh_token_hash,
        fecha_inicio=ahora,
        fecha_expiracion=fecha_expiracion,
        revocada=False,
    )

    db.add(nueva_sesion)
    db.commit()

    # 8) Crear access token
    access_token = crear_access_token(usuario)

    # 9) Responder
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )
   
