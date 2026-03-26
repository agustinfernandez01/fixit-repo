from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship
from app.db import Base


class Pedido(Base):
    __tablename__ = "pedidos"

    id_pedido = Column(Integer, primary_key=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=False)
    fecha_pedido = Column(DateTime, nullable=True)
    estado = Column(String(50), nullable=True)  # pendiente, confirmado, enviado, entregado, cancelado
    total = Column(Numeric(12, 2), nullable=True)
    observaciones = Column(Text, nullable=True)

    usuario = relationship("Usuario", backref="pedidos")
    detalle = relationship("DetallePedido", back_populates="pedido")
    pagos = relationship("Pago", back_populates="pedido")


class DetallePedido(Base):
    __tablename__ = "detalle_pedido"

    id_detalle = Column(Integer, primary_key=True, autoincrement=True)
    id_pedido = Column(Integer, ForeignKey("pedidos.id_pedido"), nullable=False)
    id_producto = Column(Integer, ForeignKey("productos.id"), nullable=False)
    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(Numeric(12, 2), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=True)

    pedido = relationship("Pedido", back_populates="detalle")
    producto = relationship("Productos", backref="detalles_pedido")


class Pago(Base):
    __tablename__ = "pagos"

    id_pago = Column(Integer, primary_key=True, autoincrement=True)
    id_pedido = Column(Integer, ForeignKey("pedidos.id_pedido"), nullable=False)
    monto = Column(Numeric(12, 2), nullable=False)
    metodo_pago = Column(String(50), nullable=True)
    estado_pago = Column(String(50), nullable=True)
    fecha_pago = Column(DateTime, nullable=True)
    referencia_externa = Column(String(255), nullable=True)

    pedido = relationship("Pedido", back_populates="pagos")
