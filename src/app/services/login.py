from sqlalchemy.orm import Session
from app.models.sesiones_login import SesionesLogin as model_sesiones
from app.models.usuarios import Usuarios as model_usuarios
from app.schemas.login import Token, LoginRequest, LoginResponse
import bcrypt
import jwt
from datetime import datetime, timedelta
from app.config import SECRET_KEY

ACCESS_TOKEN_EXPIRE_MINUTES=30
ALGORITHM="HS256"


    




