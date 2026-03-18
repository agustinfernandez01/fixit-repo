from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from typing import Optional


class TipoReparacionBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    precio_base: Optional[Decimal] = None
    tiempo_estimado: Optional[int] = None


class TipoReparacionCreate(TipoReparacionBase):
    pass


class TipoReparacionUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio_base: Optional[Decimal] = None
    tiempo_estimado: Optional[int] = None


class TipoReparacionResponse(TipoReparacionBase):
    id_tipo_reparacion: int

    class Config:
        from_attributes = True


class ReparacionBase(BaseModel):
    modelo: Optional[str] = None
    capacidad_gb: Optional[int] = None
    color: Optional[str] = None
    imei: Optional[str] = None
    falla_reportada: Optional[str] = None
    estado: Optional[str] = None
    precio_estimado: Optional[Decimal] = None
    precio_final: Optional[Decimal] = None
    observaciones: Optional[str] = None


class ReparacionCreate(ReparacionBase):
    id_usuario: int
    fecha_ingreso: Optional[datetime] = None
    fecha_estimada: Optional[datetime] = None


class ReparacionUpdate(BaseModel):
    modelo: Optional[str] = None
    capacidad_gb: Optional[int] = None
    color: Optional[str] = None
    imei: Optional[str] = None
    falla_reportada: Optional[str] = None
    estado: Optional[str] = None
    fecha_ingreso: Optional[datetime] = None
    fecha_estimada: Optional[datetime] = None
    precio_estimado: Optional[Decimal] = None
    precio_final: Optional[Decimal] = None
    observaciones: Optional[str] = None


class ReparacionResponse(ReparacionBase):
    id_reparacion: int
    id_usuario: int
    fecha_ingreso: Optional[datetime] = None
    fecha_estimada: Optional[datetime] = None

    class Config:
        from_attributes = True
