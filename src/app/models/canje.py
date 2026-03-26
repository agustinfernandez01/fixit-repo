from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Numeric, Boolean
from sqlalchemy.orm import relationship
from app.db import Base


class EquipoOfrecidoCanje(Base):
    __tablename__ = "equipos_ofrecidos_canje"

    id_equipo_ofrecido = Column(Integer, primary_key=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=False)
    modelo = Column(String(100), nullable=True)
    capacidad_gb = Column(Integer, nullable=True)
    color = Column(String(50), nullable=True)
    imei = Column(String(20), nullable=True)
    bateria_porcentaje = Column(Integer, nullable=True)
    estado_estetico = Column(String(50), nullable=True)
    estado_funcional = Column(String(50), nullable=True)
    detalle_pantalla = Column(String(255), nullable=True)
    detalle_carcasa = Column(String(255), nullable=True)
    incluye_caja = Column(Boolean, default=False)
    incluye_cargador = Column(Boolean, default=False)
    observaciones = Column(Text, nullable=True)
    fecha_registro = Column(DateTime, nullable=True)
    activo = Column(Boolean, default=True)

    usuario = relationship("Usuario", backref="equipos_ofrecidos_canje")
    solicitudes = relationship("SolicitudCanje", back_populates="equipo_ofrecido")


class SolicitudCanje(Base):
    __tablename__ = "solicitudes_canje"

    id_solicitud_canje = Column(Integer, primary_key=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=False)
    id_equipo_ofrecido = Column(
        Integer, ForeignKey("equipos_ofrecidos_canje.id_equipo_ofrecido"), nullable=False
    )
    id_producto_interes = Column(Integer, ForeignKey("productos.id"), nullable=False)
    valor_estimado = Column(Numeric(12, 2), nullable=True)
    diferencia_a_pagar = Column(Numeric(12, 2), nullable=True)
    estado = Column(String(50), nullable=True)
    fecha_solicitud = Column(DateTime, nullable=True)

    usuario = relationship("Usuario", backref="solicitudes_canje")
    equipo_ofrecido = relationship("EquipoOfrecidoCanje", back_populates="solicitudes")
    producto_interes = relationship("Productos", backref="solicitudes_canje")
