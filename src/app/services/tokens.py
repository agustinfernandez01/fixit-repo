import jwt
from datetime import datetime, timedelta
import uuid
from typing import TypedDict
from app.config import SECRET_KEY

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

class UsuarioToken(TypedDict):
    id: int
    nombre: str
    apellido: str
    email: str
    rol: str
    expire: datetime

def crear_access_token(usuario : UsuarioToken):
    now = datetime.utcnow()
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": str(usuario.id),
        "nombre": usuario.nombre +" "+usuario.apellido,
        "rol":usuario.rol,
        "type": "access",
        "expire": expire
    }

    access_token = jwt.encode(payload,SECRET_KEY,algorithm=ALGORITHM)

    return access_token, expire

def crear_refresh_token(usuario, session_id):
    now = datetime.utcnow()
    expire = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    payload = {
        "sub": str(usuario.id_usuario),  # ID del usuario
        "session_id": session_id,        # ID de la sesión en DB
        "type": "refresh",               # tipo de token
        "exp": expire                    # expiración
    }

    refresh_token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    return refresh_token, expire
