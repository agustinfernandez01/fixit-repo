from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), index=True)
    apellido = Column(String(100), index=True)
    email = Column(String(100), unique=True, index=True)
    telefono = Column(String(20), index=True)
    password_hash = Column(String(100))
    id_rol = Column(Integer, ForeignKey("roles.id"))

    rol = relationship("Rol", back_populates="usuarios")
    sesiones_login = relationship("SesionesLogin", back_populates="usuario")
    carrito = relationship("Carrito", back_populates="usuario")
    pedido = relationship("Pedido", back_populates="usuario")