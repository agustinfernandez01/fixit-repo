from typing import Optional

from pydantic import BaseModel, ConfigDict


class UsuarioCreate(BaseModel):
    nombre: str
    apellido: str
    telefono: Optional[str] = None
    email: str
    password_hash: str  # contraseña en claro (se guarda hasheada)
    id_rol: int


class UsuarioPut(BaseModel):
    nombre: str
    apellido: str
    telefono: Optional[str] = None
    email: str
    password_hash: str


class UsuarioPatch(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    password_hash: Optional[str] = None


class UsuarioResponse(BaseModel):
    id_usuario: int
    nombre: str
    apellido: str
    email: str
    telefono: Optional[str] = None
    id_rol: int
    activo: bool = True

    model_config = ConfigDict(from_attributes=True)
