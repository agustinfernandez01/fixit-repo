import bcrypt
import jwt
import hashlib
from datetime import datetime, timedelta
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
        "sub": str(usuario.id),
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
        "sub": str(usuario.id),
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


def _token_material(token: str) -> bytes:
    # bcrypt only accepts up to 72 bytes of input. We pre-hash the token so
    # refresh tokens (JWT) can be safely verified regardless of length.
    return hashlib.sha256(token.encode("utf-8")).hexdigest().encode("utf-8")


def verify_hashed_token(token: str, hashed_token: str) -> bool:
    try:
        return bcrypt.checkpw(_token_material(token), hashed_token.encode("utf-8"))
    except ValueError:
        # Compatibilidad con hashes viejos generados antes del pre-hash.
        try:
            token_bytes = token.encode("utf-8")
            if len(token_bytes) > 72:
                return False
            return bcrypt.checkpw(token_bytes, hashed_token.encode("utf-8"))
        except ValueError:
            return False

def hash_token(token: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(_token_material(token), salt)
    return hashed.decode("utf-8")

