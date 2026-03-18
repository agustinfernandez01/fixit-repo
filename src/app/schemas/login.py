from pydantic import BaseModel

class Token(BaseModel):
    access_token: str
    token_type: str
    nombre : str
    rol : int

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    id_usuario: int
    token: Token
