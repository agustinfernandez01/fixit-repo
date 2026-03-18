from typing import Optional

from pydantic import BaseModel, ConfigDict


class RolesResponse(BaseModel):
    id_rol: int
    nombre: str
    descripcion: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
