from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.db import Base
from datetime import datetime

class SesionesLogin(Base):
    __tablename__ = "sesiones_login"

    id = Column(Integer, primary_key=True, index=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id"))
    fecha_inicio = Column(DateTime, default=datetime.now)
    fecha_expiracion = Column(DateTime, default=datetime.now)
    refresh_token_hash = Column(String, nullable=False)
    revocada = Column(Boolean, default=False)

    usuario = relationship("Usuarios", back_populates="sesiones_login")
    