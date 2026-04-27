from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator
from typing import Optional


TIPOS_EQUIPO_VALIDOS = {"iphone", "ipad", "macbook", "airpods"}
ESTADOS_COMERCIALES_VALIDOS = {"nuevo", "usado"}


def _normalizar_texto(valor: object) -> Optional[str]:
    if valor is None:
        return None
    texto = str(valor).strip().lower()
    return texto or None


# Modelos de equipo
class ModeloEquipoBase(BaseModel):
    nombre_modelo: str
    capacidad_gb: Optional[int] = None
    descripcion: Optional[str] = None
    activo: bool = True


class ModeloEquipoCreate(ModeloEquipoBase):
    pass


class ModeloEquipoUpdate(BaseModel):
    nombre_modelo: Optional[str] = None
    capacidad_gb: Optional[int] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None


class ModeloEquipoResponse(ModeloEquipoBase):
    id: int
    atributos: list["ModeloAtributoResponse"] = []

    class Config:
        from_attributes = True


# Equipos
class EquipoBase(BaseModel):
    id_modelo: int
    imei: Optional[str] = None
    color: Optional[str] = None
    tipo_equipo: Optional[str] = None
    estado_comercial: Optional[str] = None
    activo: bool = True
    id_producto: Optional[int] = None  # FK opcional al catálogo de productos
    foto_url: Optional[str] = None


class EquipoCreate(EquipoBase):
    fecha_ingreso: Optional[datetime] = None
    precio_ars: Optional[Decimal] = None
    precio_usd: Optional[Decimal] = None
    opciones_configuracion_ids: list[int] = []

    @field_validator("precio_ars", "precio_usd", mode="before")
    @classmethod
    def validar_precios(cls, valor):
        if valor is None or valor == "":
            return None
        try:
            dec = Decimal(str(valor))
        except Exception as e:
            raise ValueError("Precio inválido") from e
        if dec < 0:
            raise ValueError("El precio no puede ser negativo")
        return dec

    @field_validator("tipo_equipo", mode="before")
    @classmethod
    def validar_tipo_equipo(cls, valor):
        texto = _normalizar_texto(valor)
        if texto is None:
            raise ValueError("El tipo de equipo es obligatorio")
        if texto not in TIPOS_EQUIPO_VALIDOS:
            raise ValueError(
                "Tipo de equipo inválido. Valores permitidos: iphone, ipad, macbook, airpods."
            )
        return texto

    @field_validator("estado_comercial", mode="before")
    @classmethod
    def validar_estado_comercial(cls, valor):
        texto = _normalizar_texto(valor)
        if texto is None:
            raise ValueError("El estado comercial es obligatorio")
        if texto not in ESTADOS_COMERCIALES_VALIDOS:
            raise ValueError("Estado comercial inválido. Valores permitidos: nuevo, usado.")
        return texto


class EquipoUpdate(BaseModel):
    id_modelo: Optional[int] = None
    imei: Optional[str] = None
    color: Optional[str] = None
    tipo_equipo: Optional[str] = None
    estado_comercial: Optional[str] = None
    fecha_ingreso: Optional[datetime] = None
    activo: Optional[bool] = None
    id_producto: Optional[int] = None
    precio_ars: Optional[Decimal] = None
    precio_usd: Optional[Decimal] = None
    opciones_configuracion_ids: Optional[list[int]] = None

    @field_validator("precio_ars", "precio_usd", mode="before")
    @classmethod
    def normalizar_precios(cls, valor):
        if valor is None or valor == "":
            return None
        try:
            dec = Decimal(str(valor))
        except Exception as e:
            raise ValueError("Precio inválido") from e
        if dec < 0:
            raise ValueError("El precio no puede ser negativo")
        return dec

    @field_validator("tipo_equipo", mode="before")
    @classmethod
    def normalizar_tipo_equipo(cls, valor):
        texto = _normalizar_texto(valor)
        if texto is None:
            return None
        if texto not in TIPOS_EQUIPO_VALIDOS:
            raise ValueError(
                "Tipo de equipo inválido. Valores permitidos: iphone, ipad, macbook, airpods."
            )
        return texto

    @field_validator("estado_comercial", mode="before")
    @classmethod
    def normalizar_estado_comercial(cls, valor):
        texto = _normalizar_texto(valor)
        if texto is None:
            return None
        if texto not in ESTADOS_COMERCIALES_VALIDOS:
            raise ValueError("Estado comercial inválido. Valores permitidos: nuevo, usado.")
        return texto


class EquipoResponse(EquipoBase):
    id: int
    fecha_ingreso: Optional[datetime] = None
    configuracion: list["EquipoConfiguracionResponse"] = []

    class Config:
        from_attributes = True


# Equipo con modelo anidado (una consulta trae equipo + modelo)
class EquipoConModeloResponse(EquipoResponse):
    modelo: ModeloEquipoResponse

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


class ModeloAtributoBase(BaseModel):
    code: str
    label: str
    tipo_ui: str = "chip"
    requerido: bool = True
    orden: int = 0
    activo: bool = True


class ModeloAtributoCreate(ModeloAtributoBase):
    pass


class ModeloAtributoUpdate(BaseModel):
    code: Optional[str] = None
    label: Optional[str] = None
    tipo_ui: Optional[str] = None
    requerido: Optional[bool] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None


class ModeloAtributoOpcionBase(BaseModel):
    valor: str
    label: str
    color_hex: Optional[str] = None
    orden: int = 0
    activo: bool = True


class ModeloAtributoOpcionCreate(ModeloAtributoOpcionBase):
    pass


class ModeloAtributoOpcionUpdate(BaseModel):
    valor: Optional[str] = None
    label: Optional[str] = None
    color_hex: Optional[str] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None


class ModeloAtributoOpcionResponse(ModeloAtributoOpcionBase):
    id: int
    id_atributo: int

    class Config:
        from_attributes = True


class ModeloAtributoResponse(ModeloAtributoBase):
    id: int
    id_modelo: int
    opciones: list[ModeloAtributoOpcionResponse] = []

    class Config:
        from_attributes = True


class EquipoConfiguracionResponse(BaseModel):
    id: int
    id_equipo: int
    id_atributo: int
    id_opcion: int
    atributo_code: Optional[str] = None
    atributo_label: Optional[str] = None
    opcion_valor: Optional[str] = None
    opcion_label: Optional[str] = None

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
