from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db import Base


class ModeloEquipo(Base):
    __tablename__ = "modelos_equipo"

    id = Column("id", Integer, primary_key=True, autoincrement=True)
    nombre_modelo = Column(String(100), nullable=False)
    capacidad_gb = Column(Integer, nullable=True)
    color = Column(String(50), nullable=True)
    activo = Column(Boolean, default=True)

    equipos = relationship("Equipo", back_populates="modelo")
    atributos = relationship(
        "ModeloAtributo",
        back_populates="modelo",
        cascade="all, delete-orphan",
    )


class Equipo(Base):
    __tablename__ = "equipos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_modelo = Column(Integer, ForeignKey("modelos_equipo.id"), nullable=False)
    id_producto = Column(Integer, ForeignKey("productos.id"), nullable=True)
    # Reservas de venta (checkout online). Persistimos el vínculo para que el cierre
    # operativo (finalizar_entrega) sepa exactamente qué unidad/IMEI corresponde al pedido.
    reservado_pedido_id = Column(Integer, ForeignKey("pedidos.id"), nullable=True)
    reservado_detalle_pedido_id = Column(Integer, ForeignKey("detalle_pedido.id"), nullable=True)
    imei = Column(String(20), nullable=True, unique=True)
    color = Column(String(50), nullable=True)
    tipo_equipo = Column(String(50), nullable=True)
    estado_comercial = Column(String(50), nullable=True)
    estado_comercial_previo_reserva = Column(String(50), nullable=True)
    fecha_ingreso = Column(DateTime, nullable=True)
    activo = Column(Boolean, default=True)
    foto_url = Column(String(255), nullable=True)

    modelo = relationship("ModeloEquipo", back_populates="equipos")
    producto = relationship("Productos", back_populates="equipo", uselist=False)
    detalle_usado = relationship(
        "EquipoUsadoDetalle", back_populates="equipo", uselist=False
    )
    depositos = relationship("EquipoDeposito", back_populates="equipo")
    configuraciones = relationship(
        "EquipoConfiguracion",
        back_populates="equipo",
        cascade="all, delete-orphan",
    )


class EquipoUsadoDetalle(Base):
    __tablename__ = "equipos_usados_detalle"

    id_detalle_usado = Column(Integer, primary_key=True, autoincrement=True)
    id_equipo = Column(Integer, ForeignKey("equipos.id"), nullable=False)
    bateria_porcentaje = Column(Integer, nullable=True)
    estado_estetico = Column(String(50), nullable=True)
    estado_funcional = Column(String(50), nullable=True)
    detalle_pantalla = Column(String(255), nullable=True)
    detalle_carcasa = Column(String(255), nullable=True)
    incluye_caja = Column(Boolean, default=False)
    incluye_cargador = Column(Boolean, default=False)
    observaciones = Column(Text, nullable=True)

    equipo = relationship("Equipo", back_populates="detalle_usado")


class ModeloAtributo(Base):
    __tablename__ = "modelo_atributo"
    __table_args__ = (
        UniqueConstraint("id_modelo", "code", name="uq_modelo_atributo_modelo_code"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_modelo = Column(Integer, ForeignKey("modelos_equipo.id"), nullable=False)
    code = Column(String(50), nullable=False)
    label = Column(String(100), nullable=False)
    tipo_ui = Column(String(20), nullable=False, default="chip")
    requerido = Column(Boolean, nullable=False, default=True)
    orden = Column(Integer, nullable=False, default=0)
    activo = Column(Boolean, nullable=False, default=True)

    modelo = relationship("ModeloEquipo", back_populates="atributos")
    opciones = relationship(
        "ModeloAtributoOpcion",
        back_populates="atributo",
        cascade="all, delete-orphan",
    )
    configuraciones = relationship("EquipoConfiguracion", back_populates="atributo")


class ModeloAtributoOpcion(Base):
    __tablename__ = "modelo_atributo_opcion"
    __table_args__ = (
        UniqueConstraint("id_atributo", "valor", name="uq_modelo_atributo_opcion_valor"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_atributo = Column(Integer, ForeignKey("modelo_atributo.id"), nullable=False)
    valor = Column(String(100), nullable=False)
    label = Column(String(100), nullable=False)
    color_hex = Column(String(20), nullable=True)
    orden = Column(Integer, nullable=False, default=0)
    activo = Column(Boolean, nullable=False, default=True)

    atributo = relationship("ModeloAtributo", back_populates="opciones")
    configuraciones = relationship("EquipoConfiguracion", back_populates="opcion")


class EquipoConfiguracion(Base):
    __tablename__ = "equipo_configuracion"
    __table_args__ = (
        UniqueConstraint("id_equipo", "id_atributo", name="uq_equipo_configuracion_equipo_atributo"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_equipo = Column(Integer, ForeignKey("equipos.id"), nullable=False)
    id_atributo = Column(Integer, ForeignKey("modelo_atributo.id"), nullable=False)
    id_opcion = Column(Integer, ForeignKey("modelo_atributo_opcion.id"), nullable=False)

    equipo = relationship("Equipo", back_populates="configuraciones")
    atributo = relationship("ModeloAtributo", back_populates="configuraciones")
    opcion = relationship("ModeloAtributoOpcion", back_populates="configuraciones")


# Compatibilidad hacia atrás con imports existentes.
ModelosEquipo = ModeloEquipo
Equipos = Equipo
