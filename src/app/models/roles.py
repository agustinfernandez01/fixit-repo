from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db import Base


class Rol(Base):
    __tablename__ = "roles"

    id= Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(50), nullable=False)

    usuarios = relationship("Usuario", back_populates="rol")