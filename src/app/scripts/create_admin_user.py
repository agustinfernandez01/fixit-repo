"""Crea o actualiza un usuario administrador de prueba.

Uso (desde `src`):

    python -m app.scripts.create_admin_user

Variables opcionales:

    ADMIN_EMAIL
    ADMIN_PASSWORD
    ADMIN_NOMBRE
    ADMIN_APELLIDO
    ADMIN_TELEFONO
"""

from __future__ import annotations

import argparse
import bcrypt

import app.models  # noqa: F401 - registra modelos en Base.metadata
from app.db import SessionLocal
from app.models.roles import Rol
from app.models.usuarios import Usuario

DEFAULT_EMAIL = "admin@fixit.local"
DEFAULT_PASSWORD = "Admin1234!"
DEFAULT_NOMBRE = "Admin"
DEFAULT_APELLIDO = "FixIt"
DEFAULT_TELEFONO = "5490000000000"


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def ensure_admin_user(
    *,
    email: str,
    password: str,
    nombre: str,
    apellido: str,
    telefono: str,
) -> Usuario:
    db = SessionLocal()
    try:
        rol_admin = db.query(Rol).filter(Rol.nombre == "admin").first()
        if not rol_admin:
            rol_admin = Rol(nombre="admin")
            db.add(rol_admin)
            db.flush()

        usuario = db.query(Usuario).filter(Usuario.email == email).first()
        if usuario:
            usuario.nombre = nombre
            usuario.apellido = apellido
            usuario.telefono = telefono
            usuario.password_hash = _hash_password(password)
            usuario.id_rol = rol_admin.id
            action = "actualizado"
        else:
            usuario = Usuario(
                nombre=nombre,
                apellido=apellido,
                email=email,
                telefono=telefono,
                password_hash=_hash_password(password),
                id_rol=rol_admin.id,
            )
            db.add(usuario)
            action = "creado"

        db.commit()
        db.refresh(usuario)
        print(f"Usuario admin {action}: {usuario.email}")
        print(f"Password: {password}")
        return usuario
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Crear usuario admin de prueba")
    parser.add_argument("--email", default=DEFAULT_EMAIL)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    parser.add_argument("--nombre", default=DEFAULT_NOMBRE)
    parser.add_argument("--apellido", default=DEFAULT_APELLIDO)
    parser.add_argument("--telefono", default=DEFAULT_TELEFONO)
    args = parser.parse_args()

    ensure_admin_user(
        email=args.email,
        password=args.password,
        nombre=args.nombre,
        apellido=args.apellido,
        telefono=args.telefono,
    )


if __name__ == "__main__":
    main()
