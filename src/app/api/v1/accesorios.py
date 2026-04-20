"""Módulo accesorios: alta y mantenimiento de accesorios del catálogo."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.accesorios import AccesoriosCreate, AccesoriosPatch, AccesoriosResponse
from app.services.accesorios import (
    create_accesorios,
    delete_accesorios,
    get_accesorios_by_id,
    get_accesorios_list,
    patch_accesorios,
)

router = APIRouter()


@router.get("/", response_model=list[AccesoriosResponse])
def listar_accesorios(db: Session = Depends(get_db)):
    return get_accesorios_list(db)


@router.get("/{id_accesorio}", response_model=AccesoriosResponse)
def obtener_accesorio(id_accesorio: int, db: Session = Depends(get_db)):
    obj = get_accesorios_by_id(db, id_accesorio)
    if not obj:
        raise HTTPException(status_code=404, detail="Accesorio no encontrado")
    return obj


@router.post("/", response_model=AccesoriosResponse, status_code=status.HTTP_201_CREATED)
def crear_accesorio(payload: AccesoriosCreate, db: Session = Depends(get_db)):
    try:
        return create_accesorios(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/{id_accesorio}", response_model=AccesoriosResponse)
def actualizar_accesorio(
    id_accesorio: int,
    payload: AccesoriosPatch,
    db: Session = Depends(get_db),
):
    try:
        obj = patch_accesorios(db, id_accesorio, payload)
    except ValueError as exc:
        message = str(exc)
        status_code = 404 if "no encontrado" in message.lower() else 400
        raise HTTPException(status_code=status_code, detail=message) from exc
    if not obj:
        raise HTTPException(status_code=404, detail="Accesorio no encontrado")
    return obj


@router.delete("/{id_accesorio}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_accesorio(id_accesorio: int, db: Session = Depends(get_db)):
    try:
        obj = delete_accesorios(db, id_accesorio)
    except ValueError as exc:
        message = str(exc)
        status_code = 404 if "no encontrado" in message.lower() else 400
        raise HTTPException(status_code=status_code, detail=message) from exc
    if not obj:
        raise HTTPException(status_code=404, detail="Accesorio no encontrado")
    return None