from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.db import Base
from datetime import datetime

class SesionesLogin(Base):
    __tablename__ = "sesiones_login"

    id = Column(Integer, primary_key=True, index=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id"))
    token_sesion = Column(String(255), index=True)
    fecha_inicio = Column(DateTime, default=datetime.now)
    fecha_expiracion = Column(DateTime, default=datetime.now)

    usuario = relationship("Usuarios", back_populates="sesiones_login")
    