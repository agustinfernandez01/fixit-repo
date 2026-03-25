from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db import Base


class ModeloEquipo(Base):
    __tablename__ = "modelos_equipo"

    id_modelo = Column(Integer, primary_key=True, autoincrement=True)
    nombre_modelo = Column(String(100), nullable=False)
    capacidad_gb = Column(Integer, nullable=True)
    color = Column(String(50), nullable=True)
    descripcion = Column(Text, nullable=True)
    activo = Column(Boolean, default=True)

    equipos = relationship("Equipo", back_populates="modelo")


class Equipo(Base):
    __tablename__ = "equipos"

    id_equipo = Column(Integer, primary_key=True, autoincrement=True)
    id_modelo = Column(Integer, ForeignKey("modelos_equipo.id_modelo"), nullable=False)
    imei = Column(String(20), nullable=True, unique=True)
    tipo_equipo = Column(String(50), nullable=True)  # nuevo, usado
    estado_comercial = Column(String(50), nullable=True)  # disponible, vendido, reservado, etc.
    fecha_ingreso = Column(DateTime, nullable=True)
    activo = Column(Boolean, default=True)

    modelo = relationship("ModeloEquipo", back_populates="equipos")
    detalle_usado = relationship("EquipoUsadoDetalle", back_populates="equipo", uselist=False)
    depositos = relationship("EquipoDeposito", back_populates="equipo")


class EquipoUsadoDetalle(Base):
    __tablename__ = "equipos_usados_detalle"

    id_detalle_usado = Column(Integer, primary_key=True, autoincrement=True)
    id_equipo = Column(Integer, ForeignKey("equipos.id_equipo"), nullable=False)
    bateria_porcentaje = Column(Integer, nullable=True)
    estado_estetico = Column(String(50), nullable=True)
    estado_funcional = Column(String(50), nullable=True)
    detalle_pantalla = Column(String(255), nullable=True)
    detalle_carcasa = Column(String(255), nullable=True)
    incluye_caja = Column(Boolean, default=False)
    incluye_cargador = Column(Boolean, default=False)
    observaciones = Column(Text, nullable=True)

    equipo = relationship("Equipo", back_populates="detalle_usado")
