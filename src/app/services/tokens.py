import bcrypt
import jwt
import uuid
from datetime import datetime, timedelta, timezone

from app.config import SECRET_KEY

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

class UsuarioToken():
    id: int
    nombre: str
    apellido: str
    email: str
    rol: str
    exp: datetime

def crear_access_token(usuario):
    """Acepta el modelo ORM `Usuario` (rol cargado opcional)."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    rol_nombre = usuario.rol.nombre if getattr(usuario, "rol", None) else ""

    payload = {
        "sub": str(usuario.id_usuario),
        "email": usuario.email,
        "nombre": usuario.nombre,
        "apellido": usuario.apellido,
        "rol": rol_nombre,
        "type": "access",
        "exp": expire,
    }

    access_token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    return access_token, expire

def crear_refresh_token(usuario, session_id):
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    payload = {
        "sub": str(usuario.id_usuario),
        "session_id": session_id,
        "type": "refresh",
        "exp": expire,
    }

    refresh_token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    return refresh_token, expire

def verficar_access_token(token: str) -> UsuarioToken:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise ValueError("Token inválido")
        
        usuario_token = UsuarioToken(
            id=int(payload.get("sub")),
            email=payload.get("email"),
            rol=payload.get("rol"),
            exp=datetime.fromtimestamp(payload.get("exp"))
        )
        return usuario_token
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expirado")
    except jwt.InvalidTokenError:
        raise ValueError("Token inválido")

def verificar_refresh_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise ValueError("Token inválido")
        
        return {
            "id_usuario": int(payload.get("sub")),
            "session_id": payload.get("session_id")
        }
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expirado")
    except jwt.InvalidTokenError:
        raise ValueError("Token inválido")


def verify_hashed_token(token: str, hashed_token: str) -> bool:
    return bcrypt.checkpw(token.encode("utf-8"), hashed_token.encode("utf-8"))

def hash_token(token: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(token.encode("utf-8"), salt)
    return hashed.decode("utf-8")

