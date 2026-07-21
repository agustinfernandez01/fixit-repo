"""Módulo accesorios: alta y mantenimiento de accesorios del catálogo."""

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, status, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.accesorios import Accesorios
from app.schemas.accesorios import AccesoriosCreate, AccesoriosPatch, AccesoriosResponse
from app.services.accesorios import (
    create_accesorios,
    delete_accesorios,
    get_accesorios_by_id,
    get_accesorios_list,
    patch_accesorios,
)
from app.services.storage import delete_file, key_from_url, list_files, upload_file

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


@router.post("/{id_accesorio}/foto", response_model=AccesoriosResponse)
def subir_foto_accesorio(
    id_accesorio: int,
    foto: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Sube una foto para el accesorio. Reemplaza la foto principal actual."""
    obj = db.query(Accesorios).filter(Accesorios.id == id_accesorio).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Accesorio no encontrado")

    if not foto.content_type or not foto.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen.")

    ext = Path(foto.filename or "").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        ext = ".jpg"

    content = foto.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen supera 10 MB.")

    key = f"accesorios/{id_accesorio}/{uuid4().hex}{ext}"
    obj.foto_url = upload_file(content, key, foto.content_type or "image/jpeg")
    db.commit()
    db.refresh(obj)
    data_resp = AccesoriosResponse.model_validate(obj).model_dump()
    data_resp["fotos_urls"] = list_files(f"accesorios/{id_accesorio}/")
    return data_resp


@router.delete("/{id_accesorio}/fotos", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_todas_fotos_accesorio(id_accesorio: int, db: Session = Depends(get_db)):
    """Elimina todas las fotos del accesorio de R2 y limpia foto_url en DB."""
    obj = db.query(Accesorios).filter(Accesorios.id == id_accesorio).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Accesorio no encontrado")
    for url in list_files(f"accesorios/{id_accesorio}/"):
        delete_file(key_from_url(url))
    obj.foto_url = None
    db.commit()
    return None


@router.post("/{id_accesorio}/fotos", response_model=AccesoriosResponse)
def subir_fotos_accesorio(
    id_accesorio: int,
    fotos: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """Sube hasta 2 fotos para el accesorio. Reemplaza las existentes."""
    obj = db.query(Accesorios).filter(Accesorios.id == id_accesorio).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Accesorio no encontrado")

    if not fotos:
        raise HTTPException(status_code=400, detail="Debes cargar al menos una imagen.")
    if len(fotos) > 2:
        raise HTTPException(status_code=400, detail="Puedes cargar un máximo de 2 fotos.")

    for url in list_files(f"accesorios/{id_accesorio}/"):
        delete_file(key_from_url(url))

    urls: list[str] = []
    for foto in fotos:
        if not foto.content_type or not foto.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Todos los archivos deben ser imágenes.")

        ext = Path(foto.filename or "").suffix.lower()
        if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
            ext = ".jpg"

        content = foto.file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uno de los archivos está vacío.")
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Cada imagen debe pesar hasta 10 MB.")

        key = f"accesorios/{id_accesorio}/{uuid4().hex}{ext}"
        urls.append(upload_file(content, key, foto.content_type or "image/jpeg"))

    obj.foto_url = urls[0]
    db.commit()
    db.refresh(obj)
    data_resp = AccesoriosResponse.model_validate(obj).model_dump()
    data_resp["fotos_urls"] = list_files(f"accesorios/{id_accesorio}/")
    return data_resp