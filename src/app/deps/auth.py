"""Dependencias de autenticación/autorización (JWT access)."""

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import SECRET_KEY
from app.db import get_db
from app.models.usuarios import Usuario
from app.services.tokens import ALGORITHM

security = HTTPBearer(auto_error=False)


def _decode_access_payload(token: str) -> dict | None:
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )
        if payload.get("type") != "access":
            return None
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, ValueError, TypeError):
        return None


def get_optional_user_id_from_access_token(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(security),
    ],
) -> int | None:
    """Si hay `Authorization: Bearer` válido (access), devuelve `id_usuario` desde `sub`."""
    if credentials is None:
        return None
    payload = _decode_access_payload(credentials.credentials)
    if payload is None:
        return None
    sub = payload.get("sub")
    if sub is None:
        return None
    try:
        return int(sub)
    except (TypeError, ValueError):
        return None


def require_admin_user_id(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(security),
    ],
    db: Session = Depends(get_db),
) -> int:
    """Exige access token válido y rol admin. Devuelve id_usuario."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Debes iniciar sesión.",
        )

    payload = _decode_access_payload(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
        )

    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido.",
        )

    try:
        id_usuario = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido.",
        )

    rol_claim = str(payload.get("rol") or "").strip().lower()
    is_admin_claim = "admin" in rol_claim

    # Fallback defensivo: si el claim no trae rol, lo consulta en DB.
    if not is_admin_claim:
        user_row = (
            db.query(Usuario)
            .filter(Usuario.id == id_usuario)
            .first()
        )
        rol_nombre = (
            user_row.rol.nombre.strip().lower()
            if user_row and user_row.rol and user_row.rol.nombre
            else ""
        )
        if "admin" not in rol_nombre:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No autorizado: se requiere rol admin.",
            )

    return id_usuario
