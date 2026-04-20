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


class ListaPrecioReparacionResponse(BaseModel):
    id_lista_precio: int
    categoria: str
    modelo: str
    orden: int
    precio_usd_original: Optional[Decimal] = None
    precio_ars_original: Optional[Decimal] = None
    precio_usd_alternativo: Optional[Decimal] = None
    precio_ars_alternativo: Optional[Decimal] = None

    class Config:
        from_attributes = True


class ReparacionCarritoProductoRequest(BaseModel):
    categoria: str
    modelo: str
    precio_ars: Optional[Decimal] = None
    precio_usd: Optional[Decimal] = None


class ReparacionCarritoProductoResponse(BaseModel):
    id_producto: int
    nombre: str
    precio_ars: Decimal
    precio_usd: Optional[Decimal] = None


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
