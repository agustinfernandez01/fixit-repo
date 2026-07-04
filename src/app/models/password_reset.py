from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base


class PasswordResetToken(Base):
    """Tokens de reseteo de contraseña (single-use, con expiración).

    Se guarda solo el hash del token, nunca el token plano. Ver
    `app.services.password_reset`.
    """

    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    token_hash = Column(String(512), nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.now)
    fecha_expiracion = Column(DateTime, nullable=False)
    usado = Column(Boolean, default=False, nullable=False)

    usuario = relationship("Usuario")
