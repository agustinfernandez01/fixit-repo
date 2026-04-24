from datetime import datetime
from decimal import Decimal
from enum import Enum
from pydantic import BaseModel, Field, field_validator
from typing import Optional


class ModeloCanjeBase(BaseModel):
    nombre_modelo: str
    capacidad_gb: Optional[int] = None
    foto_url: Optional[str] = None
    activo: bool = True


class ModeloCanjeCreate(ModeloCanjeBase):
    pass


class ModeloCanjeUpdate(BaseModel):
    nombre_modelo: Optional[str] = None
    capacidad_gb: Optional[int] = None
    foto_url: Optional[str] = None
    activo: Optional[bool] = None


class ModeloCanjeResponse(ModeloCanjeBase):
    id_modelo_canje: int

    class Config:
        from_attributes = True


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
    foto_url: Optional[str] = None
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
    fotos_urls: list[str] = Field(default_factory=list)

    class Config:
        from_attributes = True


class SolicitudCanjeBase(BaseModel):
    id_equipo_ofrecido: int
    id_producto_interes: int
    valor_estimado: Optional[Decimal] = None
    diferencia_a_pagar: Optional[Decimal] = None
    metodo_pago: Optional[str] = None
    estado: Optional[str] = None
    fecha_respuesta: Optional[datetime] = None


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


class SolicitudCanjeDecisionRequest(BaseModel):
    metodo_pago: Optional[str] = None


class SolicitudCanjeAdminResponse(BaseModel):
    id_solicitud_canje: int
    id_usuario: int
    cliente_nombre: Optional[str] = None
    cliente_email: Optional[str] = None
    cliente_telefono: Optional[str] = None
    id_equipo_ofrecido: int
    equipo_modelo: Optional[str] = None
    equipo_capacidad_gb: Optional[int] = None
    equipo_color: Optional[str] = None
    equipo_bateria_porcentaje: Optional[int] = None
    equipo_estado_estetico: Optional[str] = None
    equipo_estado_funcional: Optional[str] = None
    equipo_foto_url: Optional[str] = None
    equipo_fotos_urls: list[str] = Field(default_factory=list)
    id_producto_interes: int
    producto_interes_nombre: Optional[str] = None
    producto_interes_precio: Optional[Decimal] = None
    producto_interes_activo: Optional[bool] = None
    valor_estimado: Optional[Decimal] = None
    diferencia_a_pagar: Optional[Decimal] = None
    metodo_pago: Optional[str] = None
    estado: Optional[str] = None
    fecha_solicitud: Optional[datetime] = None
    fecha_respuesta: Optional[datetime] = None
    observaciones: Optional[str] = None

    class Config:
        from_attributes = True


class CotizacionCanjeBase(BaseModel):
    id_modelo_canje: int
    bateria_min: int
    bateria_max: int
    valor_toma: Decimal
    observaciones: Optional[str] = None
    activo: bool = True

    @field_validator("bateria_min", "bateria_max")
    @classmethod
    def validar_bateria_rango(cls, value: int):
        if value < 0 or value > 100:
            raise ValueError("Los rangos de batería deben estar entre 0 y 100")
        return value

    @field_validator("valor_toma")
    @classmethod
    def validar_valor_toma(cls, value: Decimal):
        if value <= 0:
            raise ValueError("El valor de toma debe ser mayor a 0")
        return value

    @field_validator("bateria_max")
    @classmethod
    def validar_rango_min_max(cls, bateria_max: int, info):
        bateria_min = info.data.get("bateria_min")
        if bateria_min is not None and bateria_max < bateria_min:
            raise ValueError("bateria_max no puede ser menor que bateria_min")
        return bateria_max


class CotizacionCanjeCreate(CotizacionCanjeBase):
    pass


class CotizacionCanjeUpdate(BaseModel):
    id_modelo_canje: Optional[int] = None
    bateria_min: Optional[int] = None
    bateria_max: Optional[int] = None
    valor_toma: Optional[Decimal] = None
    observaciones: Optional[str] = None
    activo: Optional[bool] = None


class CotizacionCanjeResponse(CotizacionCanjeBase):
    id_cotizacion: int

    class Config:
        from_attributes = True


class PresupuestoCanjeRequest(BaseModel):
    id_equipo_ofrecido: int
    id_producto_interes: int


class PresupuestoCanjeResponse(BaseModel):
    id_equipo_ofrecido: int
    id_producto_interes: int
    id_modelo_canje: int
    bateria_porcentaje: int
    valor_toma: Decimal
    precio_producto_interes: Decimal
    diferencia_a_pagar: Decimal
    aprobado: bool
    motivo_rechazo: Optional[str] = None


class ResultadoCotizacionCanje(str, Enum):
    APROBADO = "APROBADO"
    BATERIA_INVALIDA = "BATERIA_INVALIDA"
    MODELO_NO_ENCONTRADO = "MODELO_NO_ENCONTRADO"
    PRODUCTO_NO_ENCONTRADO = "PRODUCTO_NO_ENCONTRADO"
    COTIZACION_NO_DISPONIBLE = "COTIZACION_NO_DISPONIBLE"
    SIN_DIFERENCIA = "SIN_DIFERENCIA"


class CotizarCanjeRequest(BaseModel):
    id_modelo_canje: int
    bateria_porcentaje: int
    id_producto_interes: int

    @field_validator("bateria_porcentaje")
    @classmethod
    def validar_bateria(cls, value: int):
        if value < 0 or value > 100:
            raise ValueError("La bateria debe estar entre 0 y 100")
        return value


class CotizarCanjeResponse(BaseModel):
    codigo_resultado: ResultadoCotizacionCanje
    mensaje_usuario: str
    aprobado: bool
    id_modelo_canje: Optional[int] = None
    bateria_porcentaje: int
    id_producto_interes: int
    valor_toma: Optional[Decimal] = None
    precio_producto_interes: Optional[Decimal] = None
    diferencia_a_pagar: Decimal = Decimal("0.00")
