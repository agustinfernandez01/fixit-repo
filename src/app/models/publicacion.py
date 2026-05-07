from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Text, Numeric, JSON
from sqlalchemy.orm import relationship
from app.db import Base


class Publicacion(Base):
    __tablename__ = "publicaciones"

    id_publicacion = Column(Integer, primary_key=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    modelo = Column(String(100), nullable=True)
    capacidad_gb = Column(Integer, nullable=True)
    color = Column(String(50), nullable=True)
    imei = Column(String(20), nullable=True)
    bateria_porcentaje = Column(Integer, nullable=True)
    estado_estetico = Column(String(50), nullable=True)
    estado_funcional = Column(String(50), nullable=True)
    titulo = Column(String(255), nullable=True)
    descripcion = Column(Text, nullable=True)
    precio_publicado = Column(Numeric(12, 2), nullable=True)
    estado = Column(String(50), nullable=True)  # borrador, pendiente_revision, publicada, vendida
    fecha_publicacion = Column(DateTime, nullable=True)
    fotos_urls = Column(JSON, nullable=True)
    tiene_caja = Column(Boolean, nullable=True, default=False)
    tiene_cargador = Column(Boolean, nullable=True, default=False)

    usuario = relationship("Usuario", backref="publicaciones")
    revisiones = relationship("RevisionPublicacion", back_populates="publicacion")


class RevisionPublicacion(Base):
    __tablename__ = "revision_publicacion"

    id_revision = Column(Integer, primary_key=True, autoincrement=True)
    id_publicacion = Column(Integer, ForeignKey("publicaciones.id_publicacion"), nullable=False)
    estado_revision = Column(String(50), nullable=True)  # aprobada, rechazada, observaciones
    observaciones = Column(Text, nullable=True)
    fecha_revision = Column(DateTime, nullable=True)

    publicacion = relationship("Publicacion", back_populates="revisiones")


class InteresPublicacion(Base):
    __tablename__ = "interes_publicacion"

    id_interes = Column(Integer, primary_key=True, autoincrement=True)
    id_publicacion = Column(Integer, ForeignKey("publicaciones.id_publicacion"), nullable=False)
    id_usuario_interesado = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    mensaje = Column(Text, nullable=True)
    estado = Column(String(50), nullable=True)  # pendiente_contacto, contactado, cerrado
    fecha_interes = Column(DateTime, nullable=True)

    publicacion = relationship("Publicacion", backref="intereses")
    usuario_interesado = relationship("Usuario", backref="intereses_publicacion")
