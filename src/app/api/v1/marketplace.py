"""
Módulo Marketplace de usados: publicaciones y revisión de publicaciones.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Publicacion, RevisionPublicacion
from app.schemas.marketplace import (
    PublicacionCreate,
    PublicacionUpdate,
    PublicacionResponse,
    RevisionPublicacionCreate,
    RevisionPublicacionUpdate,
    RevisionPublicacionResponse,
)

router = APIRouter()


@router.get("/publicaciones", response_model=list[PublicacionResponse])
def listar_publicaciones(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    estado: str | None = Query(None, description="Filtrar por estado"),
    db: Session = Depends(get_db),
):
    q = db.query(Publicacion)
    if estado:
        q = q.filter(Publicacion.estado == estado)
    return q.offset(skip).limit(limit).all()


@router.post(
    "/publicaciones",
    response_model=PublicacionResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_publicacion(payload: PublicacionCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data.get("fecha_publicacion") is None:
        data["fecha_publicacion"] = datetime.now(timezone.utc)
    if data.get("estado") is None:
        data["estado"] = "pendiente_revision"
    obj = Publicacion(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/publicaciones/{id_publicacion}", response_model=PublicacionResponse)
def obtener_publicacion(id_publicacion: int, db: Session = Depends(get_db)):
    obj = db.query(Publicacion).filter(Publicacion.id_publicacion == id_publicacion).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    return obj


@router.patch("/publicaciones/{id_publicacion}", response_model=PublicacionResponse)
def actualizar_publicacion(
    id_publicacion: int,
    payload: PublicacionUpdate,
    db: Session = Depends(get_db),
):
    obj = db.query(Publicacion).filter(Publicacion.id_publicacion == id_publicacion).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/publicaciones/{id_publicacion}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_publicacion(id_publicacion: int, db: Session = Depends(get_db)):
    obj = db.query(Publicacion).filter(Publicacion.id_publicacion == id_publicacion).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    db.delete(obj)
    db.commit()
    return None


@router.get("/revisiones", response_model=list[RevisionPublicacionResponse])
def listar_revisiones(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return db.query(RevisionPublicacion).offset(skip).limit(limit).all()


@router.post(
    "/revisiones",
    response_model=RevisionPublicacionResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_revision(payload: RevisionPublicacionCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data.get("fecha_revision") is None:
        data["fecha_revision"] = datetime.now(timezone.utc)
    obj = RevisionPublicacion(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/revisiones/{id_revision}", response_model=RevisionPublicacionResponse)
def obtener_revision(id_revision: int, db: Session = Depends(get_db)):
    obj = db.query(RevisionPublicacion).filter(RevisionPublicacion.id_revision == id_revision).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Revisión no encontrada")
    return obj


@router.patch("/revisiones/{id_revision}", response_model=RevisionPublicacionResponse)
def actualizar_revision(
    id_revision: int,
    payload: RevisionPublicacionUpdate,
    db: Session = Depends(get_db),
):
    obj = db.query(RevisionPublicacion).filter(RevisionPublicacion.id_revision == id_revision).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Revisión no encontrada")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/revisiones/{id_revision}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_revision(id_revision: int, db: Session = Depends(get_db)):
    obj = db.query(RevisionPublicacion).filter(RevisionPublicacion.id_revision == id_revision).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Revisión no encontrada")
    db.delete(obj)
    db.commit()
    return None
