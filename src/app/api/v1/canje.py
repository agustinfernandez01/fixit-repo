"""
Módulo Canje: equipos ofrecidos para canje y solicitudes de canje.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import EquipoOfrecidoCanje, SolicitudCanje
from app.schemas.canje import (
    EquipoOfrecidoCanjeCreate,
    EquipoOfrecidoCanjeUpdate,
    EquipoOfrecidoCanjeResponse,
    SolicitudCanjeCreate,
    SolicitudCanjeUpdate,
    SolicitudCanjeResponse,
)

router = APIRouter()


@router.get("/equipos-ofrecidos", response_model=list[EquipoOfrecidoCanjeResponse])
def listar_equipos_ofrecidos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    activo: bool | None = Query(None, description="Filtrar por activo"),
    db: Session = Depends(get_db),
):
    q = db.query(EquipoOfrecidoCanje)
    if activo is not None:
        q = q.filter(EquipoOfrecidoCanje.activo == activo)
    return q.offset(skip).limit(limit).all()


@router.post(
    "/equipos-ofrecidos",
    response_model=EquipoOfrecidoCanjeResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_equipo_ofrecido(payload: EquipoOfrecidoCanjeCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data.get("fecha_registro") is None:
        data["fecha_registro"] = datetime.now(timezone.utc)
    obj = EquipoOfrecidoCanje(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get(
    "/equipos-ofrecidos/{id_equipo_ofrecido}",
    response_model=EquipoOfrecidoCanjeResponse,
)
def obtener_equipo_ofrecido(id_equipo_ofrecido: int, db: Session = Depends(get_db)):
    obj = (
        db.query(EquipoOfrecidoCanje)
        .filter(EquipoOfrecidoCanje.id_equipo_ofrecido == id_equipo_ofrecido)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Equipo ofrecido no encontrado")
    return obj


@router.patch(
    "/equipos-ofrecidos/{id_equipo_ofrecido}",
    response_model=EquipoOfrecidoCanjeResponse,
)
def actualizar_equipo_ofrecido(
    id_equipo_ofrecido: int,
    payload: EquipoOfrecidoCanjeUpdate,
    db: Session = Depends(get_db),
):
    obj = (
        db.query(EquipoOfrecidoCanje)
        .filter(EquipoOfrecidoCanje.id_equipo_ofrecido == id_equipo_ofrecido)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Equipo ofrecido no encontrado")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete(
    "/equipos-ofrecidos/{id_equipo_ofrecido}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def borrar_equipo_ofrecido(id_equipo_ofrecido: int, db: Session = Depends(get_db)):
    obj = (
        db.query(EquipoOfrecidoCanje)
        .filter(EquipoOfrecidoCanje.id_equipo_ofrecido == id_equipo_ofrecido)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Equipo ofrecido no encontrado")
    db.delete(obj)
    db.commit()
    return None


@router.get("/solicitudes", response_model=list[SolicitudCanjeResponse])
def listar_solicitudes_canje(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    estado: str | None = Query(None, description="Filtrar por estado"),
    db: Session = Depends(get_db),
):
    q = db.query(SolicitudCanje)
    if estado:
        q = q.filter(SolicitudCanje.estado == estado)
    return q.offset(skip).limit(limit).all()


@router.post(
    "/solicitudes",
    response_model=SolicitudCanjeResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_solicitud_canje(payload: SolicitudCanjeCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data.get("fecha_solicitud") is None:
        data["fecha_solicitud"] = datetime.now(timezone.utc)
    if data.get("estado") is None:
        data["estado"] = "pendiente"
    obj = SolicitudCanje(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/solicitudes/{id_solicitud_canje}", response_model=SolicitudCanjeResponse)
def obtener_solicitud_canje(id_solicitud_canje: int, db: Session = Depends(get_db)):
    obj = (
        db.query(SolicitudCanje)
        .filter(SolicitudCanje.id_solicitud_canje == id_solicitud_canje)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Solicitud de canje no encontrada")
    return obj


@router.patch("/solicitudes/{id_solicitud_canje}", response_model=SolicitudCanjeResponse)
def actualizar_solicitud_canje(
    id_solicitud_canje: int,
    payload: SolicitudCanjeUpdate,
    db: Session = Depends(get_db),
):
    obj = (
        db.query(SolicitudCanje)
        .filter(SolicitudCanje.id_solicitud_canje == id_solicitud_canje)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Solicitud de canje no encontrada")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/solicitudes/{id_solicitud_canje}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_solicitud_canje(id_solicitud_canje: int, db: Session = Depends(get_db)):
    obj = (
        db.query(SolicitudCanje)
        .filter(SolicitudCanje.id_solicitud_canje == id_solicitud_canje)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Solicitud de canje no encontrada")
    db.delete(obj)
    db.commit()
    return None
