from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db import Base


class Deposito(Base):
    __tablename__ = "depositos"

    id_deposito = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), nullable=False)
    direccion = Column(String(255), nullable=True)
    descripcion = Column(Text, nullable=True)
    activo = Column(Boolean, default=True)

    equipos = relationship("EquipoDeposito", back_populates="deposito")


class EquipoDeposito(Base):
    __tablename__ = "equipo_deposito"

    id_equipo_deposito = Column(Integer, primary_key=True, autoincrement=True)
    id_equipo = Column(Integer, ForeignKey("equipos.id_equipo"), nullable=False)
    id_deposito = Column(Integer, ForeignKey("depositos.id_deposito"), nullable=False)
    fecha_asignacion = Column(DateTime, nullable=True)

    equipo = relationship("Equipo", back_populates="depositos")
    deposito = relationship("Deposito", back_populates="equipos")
