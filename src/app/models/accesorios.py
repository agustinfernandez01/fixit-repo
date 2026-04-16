from app.db import Base
from sqlalchemy import Column, Boolean, Integer, String, DateTime, ForeignKey, Text, Numeric, Boolean
from sqlalchemy.orm import relationship


class Accesorios(Base):
    __tablename__="accesorios"

    id = Column(Integer,primary_key=True,autoincrement=True)
    tipo = Column(String(225),nullable=False)
    nombre = Column(String(225),nullable=False)
    color = Column(String(225),nullable=False)
    descripcion = Column(String(225),nullable=False)
    foto_url = Column(String(255), nullable=True)
    estado = Column(Boolean,default=True)
    id_producto = Column(Integer,ForeignKey("productos.id"),nullable=False)

    #relaciones
    productos = relationship("Productos", back_populates="accesorios")
