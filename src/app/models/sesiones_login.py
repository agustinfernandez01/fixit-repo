from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base


class SesionesLogin(Base):
    """Sesiones de refresh token (una fila por sesión de login)."""

    __tablename__ = "sesiones_login"

    id_sesion = Column(String(36), primary_key=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=False)
    refresh_token_hash = Column(String(255), nullable=False)
    fecha_inicio = Column(DateTime, default=datetime.utcnow, nullable=False)
    fecha_expiracion = Column(DateTime, nullable=False)
    revocada = Column(Boolean, default=False)

    usuario = relationship("Usuario", back_populates="sesiones_login")
