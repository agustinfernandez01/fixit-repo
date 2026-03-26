from datetime import datetime, timezone

from sqlalchemy.orm import Session, joinedload

from app.models.rol import Usuario
from app.models.sesiones_login import SesionesLogin
from app.schemas.login import LoginResponse
from app.services.tokens import (
    crear_access_token,
    verificar_refresh_token,
    verify_hashed_token,
)


def refresh_login(db: Session, refresh_token: str) -> LoginResponse:
    try:
        payload = verificar_refresh_token(refresh_token)
        id_usuario = payload["id_usuario"]
        session_id = payload["session_id"]
    except ValueError as e:
        raise ValueError(f"Refresh token inválido: {e}") from e

    sesion = (
        db.query(SesionesLogin)
        .filter(
            SesionesLogin.id_sesion == session_id,
            SesionesLogin.id_usuario == id_usuario,
            SesionesLogin.revocada.is_(False),
            SesionesLogin.fecha_expiracion > datetime.now(timezone.utc),
        )
        .first()
    )

    if not sesion:
        raise ValueError("Sesión no válida o expirada")

    if not verify_hashed_token(refresh_token, sesion.refresh_token_hash):
        raise ValueError("Refresh token no coincide")

    usuario = (
        db.query(Usuario)
        .options(joinedload(Usuario.rol))
        .filter(Usuario.id_usuario == id_usuario)
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
