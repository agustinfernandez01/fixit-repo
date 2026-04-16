from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.db import Base


class Carrito(Base):
    __tablename__ = "carrito"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    id_pedido = Column(Integer, ForeignKey("pedidos.id"), nullable=True)
    token_identificador = Column(String(255), index=True)
    estado = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime, default=datetime.now)

    usuario = relationship("Usuario", back_populates="carrito")
    pedido = relationship("Pedido", back_populates="carrito")
    carrito_detalle = relationship(
        "CarritoDetalle", back_populates="carrito", cascade="all, delete-orphan"
    )


class CarritoDetalle(Base):
    __tablename__ = "carrito_detalle"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    id_carrito = Column(Integer, ForeignKey("carrito.id"), nullable=False)
    id_producto = Column(Integer, ForeignKey("productos.id"), nullable=False)
    cant = Column(Integer, nullable=False)
    precio_unitario = Column(Numeric(12, 2), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)

    carrito = relationship("Carrito", back_populates="carrito_detalle")
    producto = relationship("Productos", back_populates="carrito_detalle")
