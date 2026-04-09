from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ProductoCarritoBase(BaseModel):
    id: int
    nombre: str
    precio: Decimal
    activo: bool
    tipo_producto: Optional[str] = None
    id_origen: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class CarritoBase(BaseModel):
    id: int
    id_usuario: Optional[int] = None
    id_pedido: Optional[int] = None
    token_identificador: Optional[str] = None
    estado: bool
    fecha_creacion: datetime

    model_config = ConfigDict(from_attributes=True)


class CarritoDetalleBase(BaseModel):
    id: int
    id_carrito: int
    id_producto: int
    cant: int
    precio_unitario: Decimal
    subtotal: Decimal
    producto: Optional[ProductoCarritoBase] = None

    model_config = ConfigDict(from_attributes=True)


class CarritoItemAdd(BaseModel):
    id_producto: int
    cant: int = Field(default=1, ge=1)


class CarritoItemUpdate(BaseModel):
    cant: int = Field(ge=1)


class CarritoCheckoutRequest(BaseModel):
    metodo_pago: str = Field(default="transferencia", min_length=2, max_length=50)
    observaciones: Optional[str] = Field(default=None, max_length=1000)


class CarritoCheckoutResponse(BaseModel):
    id_pedido: int
    id_pago: int
    estado_pedido: str
    estado_pago: str
    referencia_externa: Optional[str] = None
    whatsapp_url: str
    total: Decimal
    mensaje: str


class CarritoResumen(BaseModel):
    carrito: CarritoBase
    items: List[CarritoDetalleBase]
    total_unidades: int
    total_importe: Decimal


class CarritoCreate(BaseModel):
    id_usuario: Optional[int] = None
    id_pedido: Optional[int] = None
    token_identificador: str
    estado: bool = True
    fecha_creacion: Optional[datetime] = None


class CarritoPatch(BaseModel):
    id_usuario: Optional[int] = None
    id_pedido: Optional[int] = None
    token_identificador: Optional[str] = None
    estado: Optional[bool] = None
    fecha_creacion: Optional[datetime] = None
