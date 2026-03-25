from pydantic import BaseModel
from typing import Optional
import datetime

class ModeloEquipoBase(BaseModel):
    id: int
    nombre_modelo: str
    capacidad_gb: int
    color: str
    activo: Optional[bool] = True
    
class ModeloEquipoResponse(ModeloEquipoBase):
    pass
    class Config:
        orm_mode = True    
    
class ModeloEquipoCreate(BaseModel):
    nombre_modelo: str
    capacidad_gb: int
    color: str
    activo : bool = True
        
class ModeloEquipoPatch(BaseModel):
    nombre_modelo: Optional[str] = None
    capacidad_gb: Optional[int] = None
    color: Optional[str] = None
    activo: Optional[bool] = None

class ModeloEquipoSimple(BaseModel):
    id_modelo: int
    nombre_modelo: str
    capacidad_gb: int
    color: str
    
    class Config:
        orm_mode = True
        
# -------------------------------------------------------

class EquipoBase(BaseModel):
    id : int
    id_modelo: ModeloEquipoSimple
    id_producto: int
    imei: str
    tipo_equipo: str
    estado_comercial: str
    fecha_ingreso: datetime
    activo: bool = True
    
class EquipoResponse(EquipoBase):
    pass

    class Config:
        orm_mode = True
        
class EquipoCreate(BaseModel):
    id_modelo: int
    id_producto: int
    imei: str
    tipo_equipo: str
    estado_comercial: str
    fecha_ingreso: datetime.datetime
    activo: bool = True
    
class EquipoPatch(BaseModel):
    id_modelo: Optional[int] = None
    id_producto: Optional[int] = None
    imei: Optional[str] = None
    tipo_equipo: Optional[str] = None
    estado_comercial: Optional[str] = None
    fecha_ingreso: Optional[datetime.datetime] = None
    activo: Optional[bool] = None
    