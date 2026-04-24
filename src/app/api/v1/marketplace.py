"""
Módulo Marketplace de usados: publicaciones y revisión de publicaciones.
"""
import uuid
from datetime import datetime, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.config import UPLOAD_DIR, WHATSAPP_CHECKOUT_PHONE
from app.deps.auth import get_optional_user_id_from_access_token, require_admin_user_id
from app.db import get_db
from app.models import InteresPublicacion, Publicacion, RevisionPublicacion, Usuario
from app.schemas.marketplace import (
    PublicacionCreate,
    PublicacionUpdate,
    PublicacionResponse,
    RevisionPublicacionCreate,
    RevisionPublicacionUpdate,
    RevisionPublicacionResponse,
    InteresPublicacionCreate,
    InteresPublicacionResponse,
    InteresPublicacionUpdate,
)

router = APIRouter()

_MAX_FOTO_BYTES = 5 * 1024 * 1024
_FOTO_CT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _build_publicacion_titulo(modelo: str | None, capacidad_gb: int | None, color: str | None) -> str | None:
    parts: list[str] = []
    if modelo and str(modelo).strip():
        parts.append(str(modelo).strip())
    if capacidad_gb is not None:
        parts.append(f"{capacidad_gb} GB")
    if color and str(color).strip():
        parts.append(str(color).strip())
    if not parts:
        return None
    return " · ".join(parts)


def _publicacion_response_payload(db: Session, obj: Publicacion) -> dict:
    vendedor = db.query(Usuario).filter(Usuario.id == obj.id_usuario).first()
    vendedor_nombre = None
    vendedor_telefono = None
    if vendedor:
        vendedor_nombre = " ".join(
            p for p in [vendedor.nombre, vendedor.apellido] if p and str(p).strip()
        ) or None
        vendedor_telefono = vendedor.telefono
    return {
        "id_publicacion": obj.id_publicacion,
        "id_usuario": obj.id_usuario,
        "modelo": obj.modelo,
        "capacidad_gb": obj.capacidad_gb,
        "color": obj.color,
        "imei": obj.imei,
        "bateria_porcentaje": obj.bateria_porcentaje,
        "estado_estetico": obj.estado_estetico,
        "estado_funcional": obj.estado_funcional,
        "titulo": obj.titulo,
        "descripcion": obj.descripcion,
        "precio_publicado": obj.precio_publicado,
        "estado": obj.estado,
        "fotos_urls": obj.fotos_urls,
        "fecha_publicacion": obj.fecha_publicacion,
        "vendedor_nombre": vendedor_nombre,
        "vendedor_telefono": vendedor_telefono,
    }


def _build_marketplace_whatsapp_url(
    publicacion: Publicacion,
    comprador: Usuario | None,
    mensaje_interes: str | None = None,
) -> str:
    phone = "".join(ch for ch in WHATSAPP_CHECKOUT_PHONE if ch.isdigit())
    titulo = publicacion.titulo or publicacion.modelo or f"Publicación #{publicacion.id_publicacion}"
    equipo = " · ".join(
        part
        for part in [
            publicacion.modelo,
            f"{publicacion.capacidad_gb} GB" if publicacion.capacidad_gb else None,
            publicacion.color,
        ]
        if part and str(part).strip()
    )
    equipo = equipo or titulo
    comprador_nombre = (
        " ".join(part for part in [comprador.nombre if comprador else None, comprador.apellido if comprador else None] if part and part.strip())
        or f"Usuario #{comprador.id}" if comprador else "Cliente interesado"
    )
    comprador_contacto = comprador.telefono if comprador and comprador.telefono else (comprador.email if comprador else "sin contacto")
    precio = str(publicacion.precio_publicado) if publicacion.precio_publicado is not None else None
    mensaje = (
        f"Hola! Estoy interesado en {equipo}.\n"
        f"Publicación: {titulo} (#{publicacion.id_publicacion})\n"
        f"Mi nombre es {comprador_nombre}.\n"
        f"Mi contacto: {comprador_contacto}\n"
        f"{f'Precio publicado: ${precio}.\n' if precio else ''}"
        f"{f'Mensaje: {mensaje_interes.strip()}\n' if mensaje_interes and mensaje_interes.strip() else ''}"
        f"Cuando puedas, coordinamos."
    )
    return f"https://wa.me/{phone}?text={quote(mensaje)}"


@router.post("/upload-foto")
async def subir_foto_marketplace(file: UploadFile = File(...)):
    """Sube una imagen y devuelve la URL pública bajo /uploads/…"""
    ct = file.content_type or ""
    if ct not in _FOTO_CT:
        raise HTTPException(
            status_code=400,
            detail="Solo se permiten imágenes JPEG, PNG o WebP.",
        )
    raw = await file.read()
    if len(raw) > _MAX_FOTO_BYTES:
        raise HTTPException(
            status_code=400,
            detail="La imagen no puede superar 5 MB.",
        )
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{_FOTO_CT[ct]}"
    path = UPLOAD_DIR / name
    path.write_bytes(raw)
    return {"url": f"/uploads/{name}"}


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
    rows = q.offset(skip).limit(limit).all()
    return [_publicacion_response_payload(db, row) for row in rows]


@router.post(
    "/publicaciones",
    response_model=PublicacionResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_publicacion(
    payload: PublicacionCreate,
    db: Session = Depends(get_db),
    id_desde_token: int | None = Depends(get_optional_user_id_from_access_token),
):
    data = payload.model_dump()
    if id_desde_token is not None:
        data["id_usuario"] = id_desde_token
    elif data.get("id_usuario") is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Iniciá sesión o indicá id_usuario en el cuerpo (admin).",
        )
    if data.get("fecha_publicacion") is None:
        data["fecha_publicacion"] = datetime.now(timezone.utc)
    if data.get("estado") is None:
        data["estado"] = "pendiente_revision"
    data["titulo"] = _build_publicacion_titulo(
        data.get("modelo"),
        data.get("capacidad_gb"),
        data.get("color"),
    )
    obj = Publicacion(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _publicacion_response_payload(db, obj)


@router.get("/publicaciones/{id_publicacion}", response_model=PublicacionResponse)
def obtener_publicacion(id_publicacion: int, db: Session = Depends(get_db)):
    obj = db.query(Publicacion).filter(Publicacion.id_publicacion == id_publicacion).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    return _publicacion_response_payload(db, obj)


@router.patch("/publicaciones/{id_publicacion}", response_model=PublicacionResponse)
def actualizar_publicacion(
    id_publicacion: int,
    payload: PublicacionUpdate,
    db: Session = Depends(get_db),
):
    obj = db.query(Publicacion).filter(Publicacion.id_publicacion == id_publicacion).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")

    cambios = payload.model_dump(exclude_unset=True)
    for k, v in cambios.items():
        setattr(obj, k, v)
    if any(k in cambios for k in ("modelo", "capacidad_gb", "color", "titulo")):
        obj.titulo = _build_publicacion_titulo(obj.modelo, obj.capacidad_gb, obj.color)

    db.commit()
    db.refresh(obj)
    return _publicacion_response_payload(db, obj)


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
    _id_admin: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
):
    return db.query(RevisionPublicacion).offset(skip).limit(limit).all()


@router.post(
    "/revisiones",
    response_model=RevisionPublicacionResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_revision(
    payload: RevisionPublicacionCreate,
    _id_admin: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
):
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
    _id_admin: int = Depends(require_admin_user_id),
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
def borrar_revision(
    id_revision: int,
    _id_admin: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
):
    obj = db.query(RevisionPublicacion).filter(RevisionPublicacion.id_revision == id_revision).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Revisión no encontrada")
    db.delete(obj)
    db.commit()
    return None


@router.get("/intereses", response_model=list[InteresPublicacionResponse])
def listar_intereses(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    _id_admin: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(InteresPublicacion)
        .order_by(InteresPublicacion.fecha_interes.desc(), InteresPublicacion.id_interes.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    result: list[InteresPublicacionResponse] = []
    for row in rows:
        comprador = db.query(Usuario).filter(Usuario.id == row.id_usuario_interesado).first()
        publicacion = db.query(Publicacion).filter(Publicacion.id_publicacion == row.id_publicacion).first()
        result.append(
            InteresPublicacionResponse(
                id_interes=row.id_interes,
                id_publicacion=row.id_publicacion,
                id_usuario_interesado=row.id_usuario_interesado,
                mensaje=row.mensaje,
                estado=row.estado,
                fecha_interes=row.fecha_interes,
                comprador_nombre=(
                    " ".join(
                        part
                        for part in [comprador.nombre if comprador else None, comprador.apellido if comprador else None]
                        if part and part.strip()
                    )
                    or None
                ),
                comprador_email=comprador.email if comprador else None,
                comprador_telefono=comprador.telefono if comprador else None,
                publicacion_titulo=publicacion.titulo if publicacion else None,
                publicacion_modelo=publicacion.modelo if publicacion else None,
                whatsapp_url=(
                    _build_marketplace_whatsapp_url(publicacion, comprador, row.mensaje)
                    if publicacion
                    else None
                ),
            )
        )
    return result


@router.post(
    "/intereses",
    response_model=InteresPublicacionResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_interes(
    payload: InteresPublicacionCreate,
    db: Session = Depends(get_db),
    id_desde_token: int | None = Depends(get_optional_user_id_from_access_token),
):
    if id_desde_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Debes iniciar sesión para registrar interés.",
        )

    publicacion = db.query(Publicacion).filter(Publicacion.id_publicacion == payload.id_publicacion).first()
    if not publicacion:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    if (publicacion.estado or "").lower() != "publicada":
        raise HTTPException(status_code=400, detail="La publicación no está disponible para compra.")
    if publicacion.id_usuario == id_desde_token:
        raise HTTPException(status_code=400, detail="No puedes registrar interés sobre tu propia publicación.")

    obj = InteresPublicacion(
        id_publicacion=payload.id_publicacion,
        id_usuario_interesado=id_desde_token,
        mensaje=payload.mensaje,
        estado=payload.estado or "pendiente_contacto",
        fecha_interes=datetime.now(timezone.utc),
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)

    comprador = db.query(Usuario).filter(Usuario.id == id_desde_token).first()
    return InteresPublicacionResponse(
        id_interes=obj.id_interes,
        id_publicacion=obj.id_publicacion,
        id_usuario_interesado=obj.id_usuario_interesado,
        mensaje=obj.mensaje,
        estado=obj.estado,
        fecha_interes=obj.fecha_interes,
        comprador_nombre=(
            " ".join(
                part
                for part in [comprador.nombre if comprador else None, comprador.apellido if comprador else None]
                if part and part.strip()
            )
            or None
        ),
        comprador_email=comprador.email if comprador else None,
        comprador_telefono=comprador.telefono if comprador else None,
        publicacion_titulo=publicacion.titulo,
        publicacion_modelo=publicacion.modelo,
        whatsapp_url=_build_marketplace_whatsapp_url(publicacion, comprador, obj.mensaje),
    )


@router.patch("/intereses/{id_interes}", response_model=InteresPublicacionResponse)
def actualizar_interes(
    id_interes: int,
    payload: InteresPublicacionUpdate,
    _id_admin: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
):
    obj = db.query(InteresPublicacion).filter(InteresPublicacion.id_interes == id_interes).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Interés no encontrado")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)

    comprador = db.query(Usuario).filter(Usuario.id == obj.id_usuario_interesado).first()
    publicacion = db.query(Publicacion).filter(Publicacion.id_publicacion == obj.id_publicacion).first()
    return InteresPublicacionResponse(
        id_interes=obj.id_interes,
        id_publicacion=obj.id_publicacion,
        id_usuario_interesado=obj.id_usuario_interesado,
        mensaje=obj.mensaje,
        estado=obj.estado,
        fecha_interes=obj.fecha_interes,
        comprador_nombre=(
            " ".join(
                part
                for part in [comprador.nombre if comprador else None, comprador.apellido if comprador else None]
                if part and part.strip()
            )
            or None
        ),
        comprador_email=comprador.email if comprador else None,
        comprador_telefono=comprador.telefono if comprador else None,
        publicacion_titulo=publicacion.titulo if publicacion else None,
        publicacion_modelo=publicacion.modelo if publicacion else None,
        whatsapp_url=(
            _build_marketplace_whatsapp_url(publicacion, comprador, obj.mensaje)
            if publicacion
            else None
        ),
    )
