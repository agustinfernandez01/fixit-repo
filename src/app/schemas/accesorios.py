from decimal import Decimal
from pydantic import BaseModel, field_validator
from typing import Optional


TIPOS_ACCESORIO_VALIDOS = {"funda", "templado", "cabezal", "cable"}
TIPOS_ACCESORIO_ALIAS = {
    "cargador": "cable",
    "cabezal": "cabezal",
    "fundas": "funda",
    "templados": "templado",
    "protector": "templado",
    "glass": "templado",
    "vidrio": "templado",
}


def _normalizar_texto(valor: object) -> Optional[str]:
    if valor is None:
        return None
    texto = str(valor).strip().lower()
    return texto or None


def _normalizar_tipo_accesorio(valor: object) -> Optional[str]:
    texto = _normalizar_texto(valor)
    if texto is None:
        return None
    return TIPOS_ACCESORIO_ALIAS.get(texto, texto)

class Accesorios(BaseModel):
    id: int
    tipo: str
    nombre: str
    color: str
    descripcion: str
    foto_url: Optional[str] = None
    estado: bool = True
    id_producto: int

    class Config:
        from_attributes = True


class AccesoriosCreate(BaseModel):
    tipo: str
    nombre: str
    color: str
    descripcion: str
    precio: Decimal
    estado: bool = True

    @field_validator("tipo", mode="before")
    @classmethod
    def validar_tipo(cls, valor):
        texto = _normalizar_tipo_accesorio(valor)
        if texto is None:
            raise ValueError("El tipo de accesorio es obligatorio")
        if texto not in TIPOS_ACCESORIO_VALIDOS:
            raise ValueError(
                "Tipo de accesorio inválido. Valores permitidos: funda, templado, cabezal, cable."
            )
        return texto

    @field_validator("nombre", "color", "descripcion", mode="before")
    @classmethod
    def normalizar_texto(cls, valor):
        texto = str(valor).strip() if valor is not None else ""
        return texto

    @field_validator("precio", mode="before")
    @classmethod
    def validar_precio(cls, valor):
        if valor is None:
            raise ValueError("El precio es obligatorio")
        return valor

class AccesoriosResponse(Accesorios):
    pass
    

class AccesoriosPatch(BaseModel):
    tipo: Optional[str] = None
    nombre: Optional[str] = None
    color: Optional[str] = None
    descripcion: Optional[str] = None
    estado: Optional[bool] = None
    id_producto: Optional[int] = None

    @field_validator("tipo", mode="before")
    @classmethod
    def normalizar_tipo(cls, valor):
        texto = _normalizar_tipo_accesorio(valor)
        if texto is None:
            return None
        if texto not in TIPOS_ACCESORIO_VALIDOS:
            raise ValueError(
                "Tipo de accesorio inválido. Valores permitidos: funda, templado, cabezal, cable."
            )
        return texto

    @field_validator("nombre", "color", "descripcion", mode="before")
    @classmethod
    def normalizar_campos(cls, valor):
        if valor is None:
            return None
        texto = str(valor).strip()
        return texto or None

