from pydantic import BaseModel

class Token(BaseModel):
    access_token: str
    refresh_token: str

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    id_usuario: int
    token: Token
