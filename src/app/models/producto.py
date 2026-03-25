from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship
from app.db import Base


class CategoriaProducto(Base):
    __tablename__ = "categoria_producto"

    id_categoria = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=True)
    activo = Column(Boolean, default=True)

    productos = relationship("Producto", back_populates="categoria")


class Producto(Base):
    __tablename__ = "productos"

    id_producto = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)
    precio = Column(Numeric(12, 2), nullable=False)
    id_categoria = Column(Integer, ForeignKey("categoria_producto.id_categoria"), nullable=False)
    activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime, nullable=True)

    categoria = relationship("CategoriaProducto", back_populates="productos")
