from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from typing import Optional


# Modelos de equipo
class ModeloEquipoBase(BaseModel):
    nombre_modelo: str
    capacidad_gb: Optional[int] = None
    color: Optional[str] = None
    descripcion: Optional[str] = None
    activo: bool = True


class ModeloEquipoCreate(ModeloEquipoBase):
    pass


class ModeloEquipoUpdate(BaseModel):
    nombre_modelo: Optional[str] = None
    capacidad_gb: Optional[int] = None
    color: Optional[str] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None


class ModeloEquipoResponse(ModeloEquipoBase):
    id_modelo: int

    class Config:
        from_attributes = True


# Equipos
class EquipoBase(BaseModel):
    id_modelo: int
    imei: Optional[str] = None
    tipo_equipo: Optional[str] = None
    estado_comercial: Optional[str] = None
    activo: bool = True


class EquipoCreate(EquipoBase):
    fecha_ingreso: Optional[datetime] = None


class EquipoUpdate(BaseModel):
    id_modelo: Optional[int] = None
    imei: Optional[str] = None
    tipo_equipo: Optional[str] = None
    estado_comercial: Optional[str] = None
    fecha_ingreso: Optional[datetime] = None
    activo: Optional[bool] = None


class EquipoResponse(EquipoBase):
    id_equipo: int
    fecha_ingreso: Optional[datetime] = None

    class Config:
        from_attributes = True


# Depósitos
class DepositoBase(BaseModel):
    nombre: str
    direccion: Optional[str] = None
    descripcion: Optional[str] = None
    activo: bool = True


class DepositoCreate(DepositoBase):
    pass


class DepositoUpdate(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None


class DepositoResponse(DepositoBase):
    id_deposito: int

    class Config:
        from_attributes = True


# Equipo-Depósito (ubicación en inventario)
class EquipoDepositoCreate(BaseModel):
    id_equipo: int
    id_deposito: int
    fecha_asignacion: Optional[datetime] = None


class EquipoDepositoUpdate(BaseModel):
    id_equipo: Optional[int] = None
    id_deposito: Optional[int] = None
    fecha_asignacion: Optional[datetime] = None


class EquipoDepositoResponse(BaseModel):
    id_equipo_deposito: int
    id_equipo: int
    id_deposito: int
    fecha_asignacion: Optional[datetime] = None

    class Config:
        from_attributes = True


# Detalle equipos usados (condición en inventario)
class EquipoUsadoDetalleCreate(BaseModel):
    id_equipo: int
    bateria_porcentaje: Optional[int] = None
    estado_estetico: Optional[str] = None
    estado_funcional: Optional[str] = None
    detalle_pantalla: Optional[str] = None
    detalle_carcasa: Optional[str] = None
    incluye_caja: bool = False
    incluye_cargador: bool = False
    observaciones: Optional[str] = None


class EquipoUsadoDetalleUpdate(BaseModel):
    id_equipo: Optional[int] = None
    bateria_porcentaje: Optional[int] = None
    estado_estetico: Optional[str] = None
    estado_funcional: Optional[str] = None
    detalle_pantalla: Optional[str] = None
    detalle_carcasa: Optional[str] = None
    incluye_caja: Optional[bool] = None
    incluye_cargador: Optional[bool] = None
    observaciones: Optional[str] = None


class EquipoUsadoDetalleResponse(BaseModel):
    id_detalle_usado: int
    id_equipo: int
    bateria_porcentaje: Optional[int] = None
    estado_estetico: Optional[str] = None
    estado_funcional: Optional[str] = None
    detalle_pantalla: Optional[str] = None
    detalle_carcasa: Optional[str] = None
    incluye_caja: bool = False
    incluye_cargador: bool = False
    observaciones: Optional[str] = None

    class Config:
        from_attributes = True


# --- Schemas de tablas del COMPAÑERO (solo para referencia/FK, no exponemos rutas) ---
# Productos y categorías
class CategoriaProductoBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    activo: bool = True


class CategoriaProductoResponse(CategoriaProductoBase):
    id_categoria: int

    class Config:
        from_attributes = True


class ProductoBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    precio: Decimal
    id_categoria: int
    activo: bool = True


class ProductoResponse(ProductoBase):
    id_producto: int
    fecha_creacion: Optional[datetime] = None

    class Config:
        from_attributes = True


# Pedidos (resumen para inventario/ventas)
class PedidoResponse(BaseModel):
    id_pedido: int
    id_usuario: int
    fecha_pedido: Optional[datetime] = None
    estado: Optional[str] = None
    total: Optional[Decimal] = None

    class Config:
        from_attributes = True
