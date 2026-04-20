from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base


class SesionesLogin(Base):
    """Sesiones de refresh token (una fila por sesión de login)."""

    __tablename__ = "sesiones_login"

    id_sesion = Column("id", Integer, primary_key=True, index=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    fecha_inicio = Column(DateTime, default=datetime.now)
    fecha_expiracion = Column(DateTime, default=datetime.now)
    refresh_token_hash = Column(String(512), nullable=False)
    revocada = Column(Boolean, default=False)

    usuario = relationship("Usuario", back_populates="sesiones_login")
    
    
