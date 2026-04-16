from datetime import datetime, timedelta, timezone

import bcrypt
from sqlalchemy.orm import Session, joinedload

from app.models.sesiones_login import SesionesLogin
from app.models.usuarios import Usuario
from app.schemas.login import LoginRequest, LoginResponse
from app.services.tokens import (
    crear_access_token,
    crear_refresh_token,
    hash_token,
)

REFRESH_TOKEN_EXPIRE_DAYS = 7


def logueo(db: Session, request: LoginRequest) -> LoginResponse:
    usuario = (
        db.query(Usuario)
        .options(joinedload(Usuario.rol))
        .filter(Usuario.email == request.email)
        .first()
    )

    if not usuario:
        raise ValueError("Credenciales inválidas")

    if not bcrypt.checkpw(
        request.password.encode("utf-8"),
        usuario.password_hash.encode("utf-8"),
    ):
        raise ValueError("Credenciales inválidas")

    ahora = datetime.now(timezone.utc)
    fecha_expiracion = ahora + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    nueva_sesion = SesionesLogin(
        id_usuario=usuario.id,
        refresh_token_hash="",
        fecha_inicio=ahora,
        fecha_expiracion=fecha_expiracion,
        revocada=False,
    )

    db.add(nueva_sesion)
    db.flush()

    refresh_token, _expire = crear_refresh_token(usuario, nueva_sesion.id_sesion)
    nueva_sesion.refresh_token_hash = hash_token(refresh_token)

    db.commit()

    access_token, _ = crear_access_token(usuario)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )
