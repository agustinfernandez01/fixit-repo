from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from typing import Optional


class EquipoOfrecidoCanjeBase(BaseModel):
    modelo: Optional[str] = None
    capacidad_gb: Optional[int] = None
    color: Optional[str] = None
    imei: Optional[str] = None
    bateria_porcentaje: Optional[int] = None
    estado_estetico: Optional[str] = None
    estado_funcional: Optional[str] = None
    detalle_pantalla: Optional[str] = None
    detalle_carcasa: Optional[str] = None
    incluye_caja: bool = False
    incluye_cargador: bool = False
    observaciones: Optional[str] = None
    activo: bool = True


class EquipoOfrecidoCanjeCreate(EquipoOfrecidoCanjeBase):
    id_usuario: int
    fecha_registro: Optional[datetime] = None


class EquipoOfrecidoCanjeUpdate(BaseModel):
    modelo: Optional[str] = None
    capacidad_gb: Optional[int] = None
    color: Optional[str] = None
    imei: Optional[str] = None
    bateria_porcentaje: Optional[int] = None
    estado_estetico: Optional[str] = None
    estado_funcional: Optional[str] = None
    detalle_pantalla: Optional[str] = None
    detalle_carcasa: Optional[str] = None
    incluye_caja: Optional[bool] = None
    incluye_cargador: Optional[bool] = None
    observaciones: Optional[str] = None
    activo: Optional[bool] = None
    fecha_registro: Optional[datetime] = None


class EquipoOfrecidoCanjeResponse(EquipoOfrecidoCanjeBase):
    id_equipo_ofrecido: int
    id_usuario: int
    fecha_registro: Optional[datetime] = None

    class Config:
        from_attributes = True


class SolicitudCanjeBase(BaseModel):
    id_equipo_ofrecido: int
    id_producto_interes: int
    valor_estimado: Optional[Decimal] = None
    diferencia_a_pagar: Optional[Decimal] = None
    estado: Optional[str] = None


class SolicitudCanjeCreate(SolicitudCanjeBase):
    id_usuario: int
    fecha_solicitud: Optional[datetime] = None


class SolicitudCanjeUpdate(BaseModel):
    id_equipo_ofrecido: Optional[int] = None
    id_producto_interes: Optional[int] = None
    valor_estimado: Optional[Decimal] = None
    diferencia_a_pagar: Optional[Decimal] = None
    estado: Optional[str] = None
    fecha_solicitud: Optional[datetime] = None


class SolicitudCanjeResponse(SolicitudCanjeBase):
    id_solicitud_canje: int
    id_usuario: int
    fecha_solicitud: Optional[datetime] = None

    class Config:
        from_attributes = True
