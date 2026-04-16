from pydantic import BaseModel


class RolesResponse(BaseModel):
    id: int
    nombre: str
    
    class Config:
        from_attributes = True

