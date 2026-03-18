from pydantic import BaseModel

class RolesBase(BaseModel):
    id : int
    nombre: str

class RolesCreate(RolesBase):
    pass

class RolesResponse(RolesBase):
    class Config:
        orm_mode = True
