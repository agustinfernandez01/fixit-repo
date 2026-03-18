from sqlalchemy.orm import Session
from app.models.sesiones_login import SesionesLogin as model_sesiones
from app.models.usuarios import Usuarios as model_usuarios
from app.schemas.login import Token, LoginRequest, LoginResponse
import bcrypt
import jwt
from datetime import datetime, timedelta

ACCESS_TOKEN_EXPIRE_MINUTES=30
ALGORITHM="HS256"

def logueo(db: Session, request: LoginRequest):
    # Checkear que el usuario exista
    usuario = db.query(model_usuarios).filter(
        model_usuarios.email == request.email
    ).first()

    if not usuario:
        raise ValueError("Credenciales inválidas")

    # Checkear que la contraseña coincida con el hash guardado
    if not bcrypt.checkpw(
        request.password.encode("utf-8"),
        usuario.password_hash.encode("utf-8")
    ):
        raise ValueError("Credenciales inválidas")

    # Fechas del token
    now = datetime.utcnow()
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    # Payload del JWT
    payload = {
        "id": usuario.id,
        "email": usuario.email,
        "nombre": usuario.nombre,
        "apellido": usuario.apellido,
        "rol": usuario.id_rol,
        "exp": expire
    }

    access_token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    # Registrar sesión
    sesion = model_sesiones(
        id_usuario=usuario.id,
        token_sesion=access_token,
        fecha_inicio=now,
        fecha_expiracion=expire,
    )

    db.add(sesion)
    db.commit()
    db.refresh(sesion)

    # Armar respuesta
    token_schema = Token(
        access_token=access_token,
        token_type="bearer",
        nombre=usuario.nombre,
        rol=usuario.id_rol,
    )

    return LoginResponse(
        id_usuario=usuario.id,
        token=token_schema,
    )
    




