"""Dependencias opcionales de autenticación (JWT access)."""

from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import SECRET_KEY
from app.services.tokens import ALGORITHM

security = HTTPBearer(auto_error=False)


def get_optional_user_id_from_access_token(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(security),
    ],
) -> int | None:
    """Si hay `Authorization: Bearer` válido (access), devuelve `id_usuario` desde `sub`."""
    if credentials is None:
        return None
    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )
        if payload.get("type") != "access":
            return None
        sub = payload.get("sub")
        if sub is None:
            return None
        return int(sub)
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, ValueError, TypeError):
        return None
