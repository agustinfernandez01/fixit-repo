from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship
from app.db import Base


class CategoriaProducto(Base):
    __tablename__ = "categoria_producto"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=True)
    activo = Column(Boolean, default=True)

    productos = relationship("Productos", back_populates="categoria")


class Productos(Base):
    __tablename__ = "productos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)
    precio = Column(Numeric(12, 2), nullable=False)
    precio_usd = Column(Numeric(12, 2), nullable=True)
    id_categoria = Column(Integer, ForeignKey("categoria_producto.id"), nullable=False)
    activo = Column(Boolean, default=True)

    categoria = relationship("CategoriaProducto", back_populates="productos")
    equipo = relationship("Equipo", back_populates="producto", uselist=False)
    accesorios = relationship("Accesorios", back_populates="productos")
    detalle_pedido = relationship("DetallePedido", back_populates="producto")
    carrito_detalle = relationship("CarritoDetalle", back_populates="producto")
