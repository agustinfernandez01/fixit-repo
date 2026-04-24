from pydantic import BaseModel

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class RegisterRequest(BaseModel):
    nombre: str
    apellido: str
    email: str
    telefono: str
    password: str


class RegisterResponse(BaseModel):
    id_usuario: int
    nombre: str
    apellido: str
    email: str
    telefono: str | None = None
