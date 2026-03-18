from pydantic import BaseModel
from typing import Optional

class UsuarioBase(BaseModel):
    id : int
    nombre: str
    apellido: str
    telefono: str
    email: str
    password_hash: str
    id_rol: int

class UsuarioCreate(BaseModel):
    nombre: str
    apellido: str
    telefono: str
    email: str
    password_hash: str
    id_rol: int

class UsuarioPut(BaseModel):
      nombre : str 
      apellido : str
      telefono : str
      email : str
      password_hash : str

class UsuarioPatch(BaseModel):
      nombre : Optional[str] = None
      apellido : Optional[str] = None
      telefono : Optional[str] = None
      email : Optional[str] = None
      password_hash : Optional[str] = None

class UsuarioResponse(BaseModel):
    id : int
    nombre: str
    apellido: str
    telefono: str
    email: str
    id_rol: int

    class Config:
        orm_mode = True