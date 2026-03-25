from app.models import usuarios as model_usuarios
from app.models import sesiones_login as model_sesiones
from app.schemas.login import Token, LoginRequest, LoginResponse
from datetime import datetime, timedelta, timezone
from app.config import SECRET_KEY
from app.services.tokens import crear_access_token, crear_refresh_token, hash_token , verficar_access_token, verificar_refresh_token , verify_hashed_token
from sqlalchemy.orm import Session

def refresh_login(db: Session, refresh_token: str) -> LoginResponse:
    # 1) Verificar refresh token
    try:
        payload = verificar_refresh_token(refresh_token)
        id_usuario = payload["id_usuario"]
        session_id = payload["session_id"]
    except ValueError as e:
        raise ValueError(f"Refresh token inválido: {e}")

    # 2) Buscar sesión en DB
    sesion = db.query(model_sesiones).filter(
        model_sesiones.id_sesion == session_id,
        model_sesiones.id_usuario == id_usuario,
        model_sesiones.revocada == False,
        model_sesiones.fecha_expiracion > datetime.now(timezone.utc)
    ).first()

    if not sesion:
        raise ValueError("Sesión no válida o expirada")

    # 3) Verificar que el refresh token coincida con el hash guardado
    if not verify_hashed_token(refresh_token, sesion.refresh_token_hash):
        raise ValueError("Refresh token no coincide")

    # 4) Obtener usuario
    usuario = db.query(model_usuarios).filter(
        model_usuarios.id_usuario == id_usuario
    ).first()

    if not usuario:
        raise ValueError("Usuario no encontrado")

    # 5) Crear nuevo access token
    access_token = crear_access_token(usuario)

    # 6) Responder
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,  # El mismo refresh token se puede seguir usando hasta que expire o se revoque
        token_type="bearer"
    )