from typing import Optional

from pydantic import BaseModel


class ProductoBase(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    foto_url: Optional[str] = None
    precio: float
    precio_usd: Optional[float] = None
    id_categoria: int
    activo: bool
    tipo_producto: Optional[str] = None
    id_origen: Optional[int] = None
    tipo_equipo: Optional[str] = None
    estado_comercial: Optional[str] = None
    
    class Config:
        orm_mode = True
        
class ProductoCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    precio: float
    precio_usd: Optional[float] = None
    id_categoria: int
    activo: Optional[bool] = True
    
class ProductoPatch(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio: Optional[float] = None
    precio_usd: Optional[float] = None
    id_categoria: Optional[int] = None
    activo: Optional[bool] = None
    
class ProductoResponse(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    foto_url: Optional[str] = None
    precio: float
    precio_usd: Optional[float] = None
    id_categoria: int
    activo: bool
    tipo_producto: Optional[str] = None
    id_origen: Optional[int] = None
    tipo_equipo: Optional[str] = None
    estado_comercial: Optional[str] = None
    
    class Config:
        orm_mode = True


class ProductoEquipoDetalle(BaseModel):
    id_equipo: int
    id_modelo: Optional[int] = None
    nombre_modelo: Optional[str] = None
    capacidad_gb: Optional[int] = None
    color: Optional[str] = None
    tipo_equipo: Optional[str] = None
    estado_comercial: Optional[str] = None
    foto_url: Optional[str] = None


class ProductoAccesorioDetalle(BaseModel):
    id_accesorio: int
    tipo: str
    nombre: str
    color: Optional[str] = None
    descripcion: Optional[str] = None
    estado: bool


class VarianteTiendaItem(BaseModel):
    id_producto: int
    color: Optional[str] = None
    precio: float
    precio_usd: Optional[float] = None
    foto_url: Optional[str] = None
    nombre_corto: Optional[str] = None
    stock: int = 1
    disponible: bool = True
    atributos: dict[str, str] = {}


class AtributoDisponibleItem(BaseModel):
    code: str
    label: str
    options: list[str]


class ProductoTiendaAgrupadoResponse(BaseModel):
    tipo_catalogo: str
    id_modelo: int
    id: int
    nombre: str
    descripcion: Optional[str] = None
    foto_url: Optional[str] = None
    precio: float
    precio_usd: Optional[float] = None
    id_categoria: int
    activo: bool
    tipo_producto: Optional[str] = None
    id_origen: Optional[int] = None
    tipo_equipo: Optional[str] = None
    estado_comercial: Optional[str] = None
    stock: int
    variantes_tienda: list[VarianteTiendaItem]


class ProductoDetalleResponse(ProductoResponse):
    detalle_equipo: Optional[ProductoEquipoDetalle] = None
    detalle_accesorio: Optional[ProductoAccesorioDetalle] = None
    variantes_tienda: Optional[list[VarianteTiendaItem]] = None
    atributos_disponibles: Optional[list[AtributoDisponibleItem]] = None
