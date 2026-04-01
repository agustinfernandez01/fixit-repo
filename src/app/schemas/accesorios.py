from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from typing import Optional

class Accesorios(BaseModel):
    id :int
    tipo :str
    nombre :str
    color :str
    descripcion :str
    estado : bool = True
    id_producto :int


class AccesoriosCreate(BaseModel):
    tipo: str
    nombre: str
    color: str
    descripcion: str
    estado: bool = True
    id_producto: int

class AccesoriosResponse(Accesorios):
    pass
    

class AccesoriosPatch(BaseModel):
    tipo: Optional[str]
    nombre: Optional[str]
    color: Optional[str]
    descripcion: Optional[str]
    estado: Optional[bool] = True
    id_producto: Optional[int]

