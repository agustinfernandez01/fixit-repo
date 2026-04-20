"""
Módulo Reparaciones: tipos de reparación y solicitudes de reparación.
"""
from datetime import datetime, timezone

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import (
    CategoriaProducto,
    ListaPrecioReparacion,
    Productos,
    Reparacion,
    TipoReparacion,
)
from app.schemas.reparaciones import (
    ReparacionCarritoProductoRequest,
    ReparacionCarritoProductoResponse,
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
        description="Filtrar por slug: modulo_pantalla, bateria, camara_principal, flex_carga, tapas_traseras",
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


def _get_or_create_categoria_reparaciones(db: Session) -> CategoriaProducto:
    cat = (
        db.query(CategoriaProducto)
        .filter(CategoriaProducto.nombre == "Reparaciones")
        .first()
    )
    if cat:
        return cat
    cat = CategoriaProducto(
        nombre="Reparaciones",
        descripcion="Servicios de reparación (precios estimados por modelo).",
        activo=True,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.post(
    "/carrito-producto",
    response_model=ReparacionCarritoProductoResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_producto_reparacion_para_carrito(
    payload: ReparacionCarritoProductoRequest,
    db: Session = Depends(get_db),
):
    categoria = (payload.categoria or "").strip()
    modelo = (payload.modelo or "").strip()
    if not categoria or not modelo:
        raise HTTPException(status_code=400, detail="Faltan categoria/modelo")

    precio = (
        db.query(ListaPrecioReparacion)
        .filter(
            ListaPrecioReparacion.categoria == categoria,
            ListaPrecioReparacion.modelo == modelo,
        )
        .first()
    )
    if not precio or precio.precio_ars_original is None:
        raise HTTPException(status_code=404, detail="No hay precio para ese modelo/categoría")

    cat = _get_or_create_categoria_reparaciones(db)

    nombre = f"Reparación - {categoria} - {modelo}"
    existing = (
        db.query(Productos)
        .filter(Productos.id_categoria == cat.id, Productos.nombre == nombre)
        .first()
    )
    if existing:
        existing.activo = True
        existing.precio = Decimal(str(precio.precio_ars_original))
        db.commit()
        db.refresh(existing)
        return ReparacionCarritoProductoResponse(
            id_producto=existing.id,
            nombre=existing.nombre,
            precio_ars=Decimal(str(precio.precio_ars_original)),
            precio_usd=Decimal(str(precio.precio_usd_original)) if precio.precio_usd_original is not None else None,
        )

    producto = Productos(
        nombre=nombre,
        descripcion=f"Servicio de reparación ({categoria}) para {modelo}. Precio estimado.",
        precio=Decimal(str(precio.precio_ars_original)),
        id_categoria=cat.id,
        activo=True,
    )
    db.add(producto)
    db.commit()
    db.refresh(producto)
    return ReparacionCarritoProductoResponse(
        id_producto=producto.id,
        nombre=producto.nombre,
        precio_ars=Decimal(str(precio.precio_ars_original)),
        precio_usd=Decimal(str(precio.precio_usd_original)) if precio.precio_usd_original is not None else None,
    )


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
