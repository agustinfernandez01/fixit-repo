from pydantic import BaseModel

<<<<<<< HEAD
class Token(BaseModel):
    access_token: str
    refresh_token: str

=======
>>>>>>> origin/agustin
class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
