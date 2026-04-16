from datetime import datetime, timezone
from typing import Optional
import bcrypt
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.roles import Rol
from app.models.usuarios import Usuario
from app.schemas.usuarios import UsuarioCreate, UsuarioPatch, UsuarioPut, UsuarioResponse


def _hash_password(plain: str) -> str:
    h = bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt())
    return h.decode("utf-8") if isinstance(h, bytes) else h


def get_usuarios(db: Session) -> list[Usuario]:
    return db.query(Usuario).all()


def get_usuario_by_id(db: Session, id_usuario: int) -> Usuario| None:
    return db.query(Usuario).filter(Usuario.id == id_usuario).first()


def get_usuario_filtered(
    db: Session,
    id_usuario: Optional[int] = None,
    email: Optional[str] = None,
    nombre: Optional[str] = None,
    apellido: Optional[str] = None,
    telefono: Optional[str] = None,
):
    query = db.query(Usuario)
    if id_usuario is not None:
        query = query.filter(Usuario.id == id_usuario)
    if email is not None:
        query = query.filter(Usuario.email == email)
    if nombre is not None:
        query = query.filter(Usuario.nombre == nombre)
    if apellido is not None:
        query = query.filter(Usuario.apellido == apellido)
    if telefono is not None:
        query = query.filter(Usuario.telefono == telefono)
    return query.all()


def post_usuario(db: Session, usuario: UsuarioCreate) -> Usuario:
    nuevo = Usuario(
        nombre=usuario.nombre,
        apellido=usuario.apellido,
        telefono=usuario.telefono,
        email=usuario.email,
        password_hash=_hash_password(usuario.password_hash),
        id_rol=usuario.id_rol,
        activo=True,
        fecha_creacion=datetime.now(timezone.utc),
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


def put_usuario_completo(db: Session, id_usuario: int, usuario: UsuarioPut) -> Usuario:
    u = get_usuario_by_id(db, id_usuario)
    if not u:
        raise HTTPException(status_code=404, detail=f"Usuario con id {id_usuario} no encontrado")
    u.nombre = usuario.nombre
    u.apellido = usuario.apellido
    u.telefono = usuario.telefono
    u.email = usuario.email
    u.password_hash = _hash_password(usuario.password_hash)
    db.commit()
    db.refresh(u)
    return u


def patch_usuario(db: Session, id_usuario: int, usuario: UsuarioPatch) -> Usuario:
    u = get_usuario_by_id(db, id_usuario)
    if not u:
        raise HTTPException(status_code=404, detail=f"Usuario con id {id_usuario} no encontrado")
    if not any(
        [
            usuario.nombre is not None,
            usuario.apellido is not None,
            usuario.telefono is not None,
            usuario.email is not None,
            usuario.password_hash is not None,
        ]
    ):
        raise HTTPException(status_code=400, detail="No se proporcionaron datos para actualizar")
    if usuario.nombre is not None:
        u.nombre = usuario.nombre
    if usuario.apellido is not None:
        u.apellido = usuario.apellido
    if usuario.telefono is not None:
        u.telefono = usuario.telefono
    if usuario.email is not None:
        u.email = usuario.email
    if usuario.password_hash is not None:
        u.password_hash = _hash_password(usuario.password_hash)
    db.commit()
    db.refresh(u)
    return u


def delete_usuario(db: Session, id_usuario: int) -> bool:
    u = get_usuario_by_id(db, id_usuario)
    if not u:
        raise HTTPException(status_code=404, detail=f"Usuario con id {id_usuario} no encontrado")
    db.delete(u)
    db.commit()
    return True
