from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import Equipo, ModeloEquipo
from app.schemas.equipos import (
    EquipoCreate,
    EquipoPatch,
    EquipoResponse,
    ModeloEquipoCreate,
    ModeloEquipoPatch,
    ModeloEquipoResponse,
)

## ------------ MODELOS DE EQUIPO ------------ ##


def get_modelos(db: Session) -> List[ModeloEquipo]:
    return db.query(ModeloEquipo).all()


def get_modelo_by_id(db: Session, id_modelo: int) -> Optional[ModeloEquipo]:
    return (
        db.query(ModeloEquipo).filter(ModeloEquipo.id_modelo == id_modelo).first()
    )


def create_modelo(db: Session, modelo: ModeloEquipoCreate) -> ModeloEquipo:
    db_modelo = ModeloEquipo(
        nombre_modelo=modelo.nombre_modelo,
        capacidad_gb=modelo.capacidad_gb,
        color=modelo.color,
        activo=modelo.activo,
    )
    db.add(db_modelo)
    db.commit()
    db.refresh(db_modelo)
    return db_modelo


def update_modelo(
    db: Session, id_modelo: int, modelo_patch: ModeloEquipoPatch
) -> Optional[ModeloEquipo]:
    db_modelo = get_modelo_by_id(db, id_modelo)
    if not db_modelo:
        return None

    if modelo_patch.nombre_modelo is not None:
        db_modelo.nombre_modelo = modelo_patch.nombre_modelo
    if modelo_patch.capacidad_gb is not None:
        db_modelo.capacidad_gb = modelo_patch.capacidad_gb
    if modelo_patch.color is not None:
        db_modelo.color = modelo_patch.color
    if modelo_patch.activo is not None:
        db_modelo.activo = modelo_patch.activo

    db.commit()
    db.refresh(db_modelo)
    return db_modelo


def delete_modelo(db: Session, id_modelo: int) -> Optional[ModeloEquipo]:
    db_modelo = get_modelo_by_id(db, id_modelo)
    if not db_modelo:
        return None

    db.delete(db_modelo)
    db.commit()
    return db_modelo


## ------------ EQUIPOS ------------ ##


def get_equipos_filtered(db: Session) -> List[Equipo]:
    return db.query(Equipo).all()


def get_equipo_by_id(db: Session, id_equipo: int) -> Optional[Equipo]:
    return db.query(Equipo).filter(Equipo.id_equipo == id_equipo).first()
