from sqlalchemy.orm import Session
from app.models.usuarios import Usuarios
from app.schemas.usuarios import UsuarioCreate, UsuarioResponse, UsuarioPut, UsuarioPatch
import bcrypt
from typing import Optional

#GET - Obtener todos los usuarios
def get_usuarios(db: Session) -> list[UsuarioResponse]:
    return db.query(Usuarios).all()

#GET - Obtener usuario por id
def get_usuario_by_id (db: Session, id: int) -> UsuarioResponse:
    return db.query(Usuarios).filter(Usuarios.id == id).first()

#GET - Obtener usuario por filtros
def get_usuario_filtered(
    db: Session,
    id: Optional[int] = None,
    email: Optional[str] = None,
    nombre: Optional[str] = None,
    apellido: Optional[str] = None,
    telefono: Optional[str] = None,
):
    query = db.query(Usuarios)

    if id is not None:
        query = query.filter(Usuarios.id == id)
    if email is not None:
        query = query.filter(Usuarios.email == email)
    if nombre is not None:
        query = query.filter(Usuarios.nombre == nombre)
    if apellido is not None:
        query = query.filter(Usuarios.apellido == apellido)
    if telefono is not None:
        query = query.filter(Usuarios.telefono == telefono)

    return query.all()

#POST - Crear usuario
def post_usuario(db: Session, usuario: UsuarioCreate) -> UsuarioResponse:
    # Hashear la contraseña
    password_hash = bcrypt.hashpw(usuario.password_hash.encode('utf-8'), bcrypt.gensalt())
    # Crear el usuario
    nuevo_usuario = Usuarios(nombre=usuario.nombre, apellido=usuario.apellido, telefono=usuario.telefono, email=usuario.email, password_hash=password_hash, id_rol=usuario.id_rol)
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return nuevo_usuario

#PUT - Actualizar usuario (completo)
def put_usuario_completo(db: Session, id: int, usuario: UsuarioPut) -> UsuarioResponse:
    # Hashear la contraseña
    password_hash = bcrypt.hashpw(usuario.password_hash.encode('utf-8'), bcrypt.gensalt())
    # Verificar si el usuario existe
    usuario_actualizado = get_usuario_by_id(db, id)
    if not usuario_actualizado:
        raise errors.UsuarioNoEncontradoError(f"Usuario con id {id} no encontrado")
    usuario_actualizado.nombre = usuario.nombre
    usuario_actualizado.apellido = usuario.apellido
    usuario_actualizado.telefono = usuario.telefono
    usuario_actualizado.email = usuario.email
    usuario_actualizado.password_hash = password_hash
    db.commit()
    db.refresh(usuario_actualizado)
    return usuario_actualizado

#patch - Actualizar usuario (parcial)
def patch_usuario(db: Session, id: int, usuario: UsuarioPatch) -> UsuarioResponse:
    # Verificar si el usuario existe
    usuario_actualizado = get_usuario_by_id(db, id)
    if not usuario_actualizado:
        raise errors.UsuarioNoEncontradoError(f"Usuario con id {id} no encontrado")
    # Verificar si se proporcionaron datos para actualizar
    if not any([usuario.nombre, usuario.apellido, usuario.telefono, usuario.email, usuario.password_hash]):
        raise errors.UsuarioNoActualizadoError(f"No se proporcionaron datos para actualizar")

    if usuario.nombre is not None:
        usuario_actualizado.nombre = usuario.nombre
    if usuario.apellido is not None:
        usuario_actualizado.apellido = usuario.apellido
    if usuario.telefono is not None:
        usuario_actualizado.telefono = usuario.telefono
    if usuario.email is not None:
        usuario_actualizado.email = usuario.email
    if usuario.password_hash is not None:
        # Hashear la contraseña
        usuario_actualizado.password_hash = bcrypt.hashpw(usuario.password_hash.encode('utf-8'), bcrypt.gensalt())
    db.commit()
    db.refresh(usuario_actualizado)
    return usuario_actualizado

#DELETE - Eliminar usuario
def delete_usuario(db: Session, id: int) -> bool:
    usuario_a_eliminar = get_usuario_by_id(db, id)
    if not usuario_a_eliminar:
        raise errors.UsuarioNoEncontradoError(f"Usuario con id {id} no encontrado")
    db.delete(usuario_a_eliminar)
    db.commit()
    return True