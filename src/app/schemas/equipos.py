from pydantic import BaseModel, field_validator
from typing import Optional
import datetime

class ModeloEquipoBase(BaseModel):
    id: int
    nombre_modelo: str
    capacidad_gb: Optional[int] = None
    color: str
    activo: Optional[bool] = True
    
class ModeloEquipoResponse(ModeloEquipoBase):
    pass

    @field_validator("color", mode="before")
    @classmethod
    def normalizar_color(cls, value):
        if value is None:
            return "Sin color"
        texto = str(value).strip()
        return texto or "Sin color"

    class Config:
        from_attributes = True
    
class ModeloEquipoCreate(BaseModel):
    nombre_modelo: str
    capacidad_gb: Optional[int] = None
    color: str
    activo : bool = True
        
class ModeloEquipoPatch(BaseModel):
    nombre_modelo: Optional[str] = None
    capacidad_gb: Optional[int] = None
    color: Optional[str] = None
    activo: Optional[bool] = None
    
class ModeloEquipoSimple(BaseModel):
    id: int
    nombre_modelo: str
    capacidad_gb: Optional[int] = None
    color: str

    @field_validator("color", mode="before")
    @classmethod
    def normalizar_color(cls, value):
        if value is None:
            return "Sin color"
        texto = str(value).strip()
        return texto or "Sin color"

    class Config:
        from_attributes = True
        
# -------------------------------------------------------

class EquipoBase(BaseModel):
    id : int
    id_modelo: int
    id_producto: int
    imei: str
    tipo_equipo: str
    estado_comercial: str
    fecha_ingreso: datetime.datetime
    activo: bool = True
    
class EquipoResponse(BaseModel):
    id: int
    id_producto: int
    imei: str
    tipo_equipo: str
    estado_comercial: str
    fecha_ingreso: datetime.datetime
    activo: bool = True
    modelo: ModeloEquipoSimple

    class Config:
        from_attributes = True

#ingreso del equipo al sistema , se crea un producto asociado al equipo, y se asigna el id del producto al equipo
class EquipoCreate(BaseModel):
    id_modelo: int
    id_categoria: int
    imei: str
    descripcion: str
    tipo_equipo: str
    estado_comercial: str
    precio: float
    fecha_ingreso: datetime.date
    activo: bool = True
    
class EquipoPatch(BaseModel):
    id_modelo: Optional[int] = None
    id_producto: Optional[int] = None
    imei: Optional[str] = None
    tipo_equipo: Optional[str] = None
    estado_comercial: Optional[str] = None
    fecha_ingreso: Optional[datetime.datetime] = None
    activo: Optional[bool] = None
    