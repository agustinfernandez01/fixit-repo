from app.models.usuarios import Usuario as model_usuarios
from app.models.sesiones_login import SesionesLogin as model_sesiones
from app.schemas.login import LoginResponse
from datetime import datetime, timedelta, timezone
from app.config import SECRET_KEY
from app.services.tokens import crear_access_token, crear_refresh_token, hash_token , verficar_access_token, verificar_refresh_token , verify_hashed_token
from sqlalchemy.orm import Session, joinedload

def refresh_login(db: Session, refresh_token: str) -> LoginResponse:
    try:
        payload = verificar_refresh_token(refresh_token)
        id_usuario = payload["id_usuario"]
        session_id = payload["session_id"]
    except ValueError as e:
        raise ValueError(f"Refresh token inválido: {e}") from e

    sesion = (
        db.query(model_sesiones)
        .filter(
            model_sesiones.id_sesion == session_id,
            model_sesiones.id_usuario == id_usuario,
            model_sesiones.revocada.is_(False),
            model_sesiones.fecha_expiracion > datetime.now(timezone.utc),
        )
        .first()
    )

    if not sesion:
        raise ValueError("Sesión no válida o expirada")

    if not verify_hashed_token(refresh_token, sesion.refresh_token_hash):
        raise ValueError("Refresh token no coincide")

    usuario = (
        db.query(model_usuarios)
        .options(joinedload(model_usuarios.rol))
        .filter(model_usuarios.id == id_usuario)
        .first()
    )

    if not usuario:
        raise ValueError("Usuario no encontrado")

    access_token, _ = crear_access_token(usuario)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )
