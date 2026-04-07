from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship
from app.db import Base


class TipoReparacion(Base):
    __tablename__ = "tipos_reparacion"

    id_tipo_reparacion = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=True)
    precio_base = Column(Numeric(12, 2), nullable=True)
    tiempo_estimado = Column(Integer, nullable=True)  # minutos o días según convención


class ListaPrecioReparacion(Base):
    """
    Listado público de precios por modelo (módulo con original/alternativo, u otros servicios con un solo par USD/ARS).
    categoria: modulo_pantalla | bateria | camara_principal | flex_carga
    """

    __tablename__ = "lista_precios_reparacion"

    id_lista_precio = Column(Integer, primary_key=True, autoincrement=True)
    categoria = Column(String(40), nullable=False, index=True)
    modelo = Column(String(150), nullable=False)
    orden = Column(Integer, nullable=False, default=0)
    precio_usd_original = Column(Numeric(12, 2), nullable=True)
    precio_ars_original = Column(Numeric(14, 2), nullable=True)
    precio_usd_alternativo = Column(Numeric(12, 2), nullable=True)
    precio_ars_alternativo = Column(Numeric(14, 2), nullable=True)


class Reparacion(Base):
    __tablename__ = "reparaciones"

    id_reparacion = Column(Integer, primary_key=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=False)
    modelo = Column(String(100), nullable=True)
    capacidad_gb = Column(Integer, nullable=True)
    color = Column(String(50), nullable=True)
    imei = Column(String(20), nullable=True)
    falla_reportada = Column(Text, nullable=True)
    estado = Column(String(50), nullable=True)  # ingresado, en taller, terminado, entregado, etc.
    fecha_ingreso = Column(DateTime, nullable=True)
    fecha_estimada = Column(DateTime, nullable=True)
    precio_estimado = Column(Numeric(12, 2), nullable=True)
    precio_final = Column(Numeric(12, 2), nullable=True)
    observaciones = Column(Text, nullable=True)

    usuario = relationship("Usuario", backref="reparaciones")
