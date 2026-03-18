from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from typing import Optional


class PublicacionBase(BaseModel):
    modelo: Optional[str] = None
    capacidad_gb: Optional[int] = None
    color: Optional[str] = None
    imei: Optional[str] = None
    bateria_porcentaje: Optional[int] = None
    estado_estetico: Optional[str] = None
    estado_funcional: Optional[str] = None
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    precio_publicado: Optional[Decimal] = None
    estado: Optional[str] = None


class PublicacionCreate(PublicacionBase):
    id_usuario: int
    fecha_publicacion: Optional[datetime] = None


class PublicacionUpdate(BaseModel):
    modelo: Optional[str] = None
    capacidad_gb: Optional[int] = None
    color: Optional[str] = None
    imei: Optional[str] = None
    bateria_porcentaje: Optional[int] = None
    estado_estetico: Optional[str] = None
    estado_funcional: Optional[str] = None
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    precio_publicado: Optional[Decimal] = None
    estado: Optional[str] = None
    fecha_publicacion: Optional[datetime] = None


class PublicacionResponse(PublicacionBase):
    id_publicacion: int
    id_usuario: int
    fecha_publicacion: Optional[datetime] = None

    class Config:
        from_attributes = True


class RevisionPublicacionBase(BaseModel):
    estado_revision: Optional[str] = None
    observaciones: Optional[str] = None


class RevisionPublicacionCreate(RevisionPublicacionBase):
    id_publicacion: int
    fecha_revision: Optional[datetime] = None


class RevisionPublicacionUpdate(BaseModel):
    estado_revision: Optional[str] = None
    observaciones: Optional[str] = None
    fecha_revision: Optional[datetime] = None


class RevisionPublicacionResponse(RevisionPublicacionBase):
    id_revision: int
    id_publicacion: int
    fecha_revision: Optional[datetime] = None

    class Config:
        from_attributes = True
