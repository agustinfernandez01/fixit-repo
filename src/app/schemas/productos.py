from pydantic import BaseModel
from typing import Optional


class ProductoBase(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    precio: float
    id_categoria: int
    activo: bool
    tipo_producto: Optional[str] = None
    id_origen: Optional[int] = None
    
    class Config:
        orm_mode = True
        
class ProductoCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    precio: float
    id_categoria: int
    activo: Optional[bool] = True
    
class ProductoPatch(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio: Optional[float] = None
    id_categoria: Optional[int] = None
    activo: Optional[bool] = None
    
class ProductoResponse(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    precio: float
    id_categoria: int
    activo: bool
    tipo_producto: Optional[str] = None
    id_origen: Optional[int] = None
    
    class Config:
        orm_mode = True
