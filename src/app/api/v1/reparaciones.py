"""
Módulo Reparaciones: tipos de reparación y solicitudes de reparación.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import TipoReparacion, ListaPrecioReparacion, Reparacion
from app.schemas.reparaciones import (
    TipoReparacionCreate,
    TipoReparacionUpdate,
    TipoReparacionResponse,
    ListaPrecioReparacionResponse,
    ReparacionCreate,
    ReparacionUpdate,
    ReparacionResponse,
)

router = APIRouter()


@router.get("/lista-precios", response_model=list[ListaPrecioReparacionResponse])
def listar_precios_reparacion(
    categoria: str | None = Query(
        None,
        description="Filtrar por slug: modulo_pantalla, bateria, camara_principal, flex_carga",
    ),
    db: Session = Depends(get_db),
):
    q = db.query(ListaPrecioReparacion).order_by(
        ListaPrecioReparacion.categoria,
        ListaPrecioReparacion.orden,
        ListaPrecioReparacion.modelo,
    )
    if categoria:
        q = q.filter(ListaPrecioReparacion.categoria == categoria)
    return q.all()


@router.get("/tipos", response_model=list[TipoReparacionResponse])
def listar_tipos_reparacion(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return db.query(TipoReparacion).offset(skip).limit(limit).all()


@router.post(
    "/tipos",
    response_model=TipoReparacionResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_tipo_reparacion(payload: TipoReparacionCreate, db: Session = Depends(get_db)):
    obj = TipoReparacion(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/tipos/{id_tipo_reparacion}", response_model=TipoReparacionResponse)
def obtener_tipo_reparacion(id_tipo_reparacion: int, db: Session = Depends(get_db)):
    obj = (
        db.query(TipoReparacion)
        .filter(TipoReparacion.id_tipo_reparacion == id_tipo_reparacion)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Tipo de reparación no encontrado")
    return obj


@router.patch("/tipos/{id_tipo_reparacion}", response_model=TipoReparacionResponse)
def actualizar_tipo_reparacion(
    id_tipo_reparacion: int,
    payload: TipoReparacionUpdate,
    db: Session = Depends(get_db),
):
    obj = (
        db.query(TipoReparacion)
        .filter(TipoReparacion.id_tipo_reparacion == id_tipo_reparacion)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Tipo de reparación no encontrado")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/tipos/{id_tipo_reparacion}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_tipo_reparacion(id_tipo_reparacion: int, db: Session = Depends(get_db)):
    obj = (
        db.query(TipoReparacion)
        .filter(TipoReparacion.id_tipo_reparacion == id_tipo_reparacion)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Tipo de reparación no encontrado")
    db.delete(obj)
    db.commit()
    return None


@router.get("/solicitudes", response_model=list[ReparacionResponse])
def listar_reparaciones(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    estado: str | None = Query(None, description="Filtrar por estado"),
    db: Session = Depends(get_db),
):
    q = db.query(Reparacion)
    if estado:
        q = q.filter(Reparacion.estado == estado)
    return q.offset(skip).limit(limit).all()


@router.post(
    "/solicitudes",
    response_model=ReparacionResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_reparacion(payload: ReparacionCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data.get("fecha_ingreso") is None:
        data["fecha_ingreso"] = datetime.now(timezone.utc)
    if data.get("estado") is None:
        data["estado"] = "ingresado"

    obj = Reparacion(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/solicitudes/{id_reparacion}", response_model=ReparacionResponse)
def obtener_reparacion(id_reparacion: int, db: Session = Depends(get_db)):
    obj = db.query(Reparacion).filter(Reparacion.id_reparacion == id_reparacion).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Reparación no encontrada")
    return obj


@router.patch("/solicitudes/{id_reparacion}", response_model=ReparacionResponse)
def actualizar_reparacion(
    id_reparacion: int,
    payload: ReparacionUpdate,
    db: Session = Depends(get_db),
):
    obj = db.query(Reparacion).filter(Reparacion.id_reparacion == id_reparacion).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Reparación no encontrada")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/solicitudes/{id_reparacion}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_reparacion(id_reparacion: int, db: Session = Depends(get_db)):
    obj = db.query(Reparacion).filter(Reparacion.id_reparacion == id_reparacion).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Reparación no encontrada")
    db.delete(obj)
    db.commit()
    return None
