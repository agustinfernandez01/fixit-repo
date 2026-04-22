from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from typing import List, Optional


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
    fotos_urls: Optional[List[str]] = None


class PublicacionCreate(PublicacionBase):
    """Si enviás `Authorization: Bearer` (access), `id_usuario` se toma del token.
    Si no hay token, debe indicarse `id_usuario` en el cuerpo (p. ej. panel admin)."""

    id_usuario: Optional[int] = None
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
    fotos_urls: Optional[List[str]] = None


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


class InteresPublicacionBase(BaseModel):
    mensaje: Optional[str] = None
    estado: Optional[str] = None


class InteresPublicacionCreate(InteresPublicacionBase):
    id_publicacion: int


class InteresPublicacionUpdate(BaseModel):
    mensaje: Optional[str] = None
    estado: Optional[str] = None


class InteresPublicacionResponse(InteresPublicacionBase):
    id_interes: int
    id_publicacion: int
    id_usuario_interesado: int
    fecha_interes: Optional[datetime] = None
    comprador_nombre: Optional[str] = None
    comprador_email: Optional[str] = None
    comprador_telefono: Optional[str] = None
    publicacion_titulo: Optional[str] = None
    publicacion_modelo: Optional[str] = None
    whatsapp_url: Optional[str] = None

    class Config:
        from_attributes = True
