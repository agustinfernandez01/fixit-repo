from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    Numeric,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.db import Base


class ModeloCanje(Base):
    __tablename__ = "modelos_canje"

    id_modelo_canje = Column(Integer, primary_key=True, autoincrement=True)
    nombre_modelo = Column(String(100), nullable=False)
    capacidad_gb = Column(Integer, nullable=True)
    foto_url = Column(String(255), nullable=True)
    activo = Column(Boolean, default=True)


class EquipoOfrecidoCanje(Base):
    __tablename__ = "equipos_ofrecidos_canje"

    id_equipo_ofrecido = Column(Integer, primary_key=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
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
    id_usuario = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    id_equipo_ofrecido = Column(
        Integer, ForeignKey("equipos_ofrecidos_canje.id_equipo_ofrecido"), nullable=False
    )
    id_producto_interes = Column(Integer, ForeignKey("productos.id"), nullable=False)
    valor_estimado = Column(Numeric(12, 2), nullable=True)
    diferencia_a_pagar = Column(Numeric(12, 2), nullable=True)
    metodo_pago = Column(String(50), nullable=True)
    estado = Column(String(50), nullable=True)
    fecha_solicitud = Column(DateTime, nullable=True)
    fecha_respuesta = Column(DateTime, nullable=True)

    usuario = relationship("Usuario", backref="solicitudes_canje")
    equipo_ofrecido = relationship("EquipoOfrecidoCanje", back_populates="solicitudes")
    producto_interes = relationship("Productos", backref="solicitudes_canje")


class CotizacionCanje(Base):
    __tablename__ = "cotizaciones_canje"
    __table_args__ = (
        UniqueConstraint(
            "id_modelo_canje",
            "bateria_min",
            "bateria_max",
            name="uq_cotizacion_modelo_rango_bateria",
        ),
    )

    id_cotizacion = Column(Integer, primary_key=True, autoincrement=True)
    id_modelo_canje = Column(Integer, ForeignKey("modelos_canje.id_modelo_canje"), nullable=False)
    bateria_min = Column(Integer, nullable=False)
    bateria_max = Column(Integer, nullable=False)
    valor_toma = Column(Numeric(12, 2), nullable=False)
    observaciones = Column(Text, nullable=True)
    activo = Column(Boolean, default=True)

    modelo_canje = relationship("ModeloCanje", backref="cotizaciones_canje")
