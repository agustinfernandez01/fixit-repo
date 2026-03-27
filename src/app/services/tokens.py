import bcrypt
import jwt
from datetime import datetime, timedelta
import uuid
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

def crear_access_token(usuario : UsuarioToken):
    now = datetime.utcnow()
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": str(usuario.id),
        "email": usuario.email,
        "nombre": usuario.nombre,
        "apellido": usuario.apellido,
        "rol":usuario.rol,
        "type": "access",
        "exp": expire,
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

