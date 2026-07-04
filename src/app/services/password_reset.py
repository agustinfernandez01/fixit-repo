"""Lógica de reseteo de contraseña por token de un solo uso.

Flujo:
  1. `solicitar_reset` genera un token aleatorio, guarda solo su hash y manda
     un email con el link. Siempre responde igual (anti-enumeración de emails).
  2. `confirmar_reset` valida el token (existe / no expirado / no usado),
     actualiza el password_hash, marca el token como usado y revoca las
     sesiones de login activas del usuario.
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from sqlalchemy.orm import Session

from app.config import (
    FRONTEND_BASE_URL,
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
)
from app.models.password_reset import PasswordResetToken
from app.models.sesiones_login import SesionesLogin
from app.models.usuarios import Usuario
from app.services.email import EmailNoConfigurado, enviar_email_reset
from app.services.tokens import hash_token, verify_hashed_token

logger = logging.getLogger(__name__)

MENSAJE_GENERICO = (
    "Si existe una cuenta con ese email, te enviamos un enlace para "
    "restablecer tu contraseña."
)


def _hash_password(plain: str) -> str:
    h = bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt())
    return h.decode("utf-8") if isinstance(h, bytes) else h


def solicitar_reset(db: Session, email: str) -> str:
    """Genera y envía (por email) un token de reseteo. Respuesta genérica siempre."""
    email = (email or "").strip().lower()
    usuario = db.query(Usuario).filter(Usuario.email == email).first()

    # No revelamos si el email existe: siempre devolvemos el mismo mensaje.
    if not usuario:
        return MENSAJE_GENERICO

    ahora = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(32)

    registro = PasswordResetToken(
        id_usuario=usuario.id,
        token_hash=hash_token(token),
        fecha_creacion=ahora,
        fecha_expiracion=ahora + timedelta(minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
        usado=False,
    )
    db.add(registro)
    db.commit()

    link = f"{FRONTEND_BASE_URL}/reset-password?token={token}"
    try:
        enviar_email_reset(usuario.email, usuario.nombre or "", link)
    except EmailNoConfigurado:
        # En dev sin API key: logueamos el link para poder probar el flujo.
        logger.warning("Email no configurado. Link de reseteo (solo dev): %s", link)
    except Exception:  # noqa: BLE001 - no filtramos el fallo al cliente
        logger.exception("Falló el envío del email de reseteo a %s", usuario.email)

    return MENSAJE_GENERICO


def confirmar_reset(db: Session, token: str, nueva_password: str) -> str:
    """Valida el token y actualiza la contraseña. Revoca sesiones activas."""
    token = (token or "").strip()
    nueva_password = (nueva_password or "").strip()
    if not token or not nueva_password:
        raise ValueError("Token y nueva contraseña son obligatorios.")

    ahora = datetime.now(timezone.utc)

    # Buscamos entre los tokens vigentes (no usados y no expirados) y verificamos
    # el hash, ya que solo guardamos el hash del token.
    candidatos = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.usado.is_(False),
            PasswordResetToken.fecha_expiracion >= ahora,
        )
        .order_by(PasswordResetToken.id.desc())
        .all()
    )

    registro = next(
        (r for r in candidatos if verify_hashed_token(token, r.token_hash)),
        None,
    )
    if not registro:
        raise ValueError("El enlace de reseteo es inválido o expiró.")

    usuario = db.query(Usuario).filter(Usuario.id == registro.id_usuario).first()
    if not usuario:
        raise ValueError("El enlace de reseteo es inválido o expiró.")

    usuario.password_hash = _hash_password(nueva_password)
    registro.usado = True

    # Cierra sesión en todos los dispositivos: revoca refresh tokens activos.
    (
        db.query(SesionesLogin)
        .filter(
            SesionesLogin.id_usuario == usuario.id,
            SesionesLogin.revocada.is_(False),
        )
        .update({SesionesLogin.revocada: True}, synchronize_session=False)
    )

    db.commit()
    return "Tu contraseña se actualizó correctamente. Ya podés iniciar sesión."
