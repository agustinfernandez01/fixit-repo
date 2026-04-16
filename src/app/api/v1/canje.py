"""
Módulo Canje: equipos ofrecidos para canje y solicitudes de canje.
"""
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.config import UPLOAD_DIR
from app.db import get_db
from app.models import ModeloCanje, EquipoOfrecidoCanje, SolicitudCanje, CotizacionCanje, Productos
from app.schemas.canje import (
    ModeloCanjeCreate,
    ModeloCanjeUpdate,
    ModeloCanjeResponse,
    EquipoOfrecidoCanjeCreate,
    EquipoOfrecidoCanjeUpdate,
    EquipoOfrecidoCanjeResponse,
    SolicitudCanjeCreate,
    SolicitudCanjeUpdate,
    SolicitudCanjeResponse,
    CotizacionCanjeCreate,
    CotizacionCanjeUpdate,
    CotizacionCanjeResponse,
    PresupuestoCanjeRequest,
    PresupuestoCanjeResponse,
    CotizarCanjeRequest,
    CotizarCanjeResponse,
    ResultadoCotizacionCanje,
)

router = APIRouter()


def _resolver_modelo_equipo_ofrecido(db: Session, equipo: EquipoOfrecidoCanje) -> ModeloCanje:
    if not equipo.modelo:
        raise HTTPException(
            status_code=400,
            detail="El equipo ofrecido no tiene modelo informado para calcular canje.",
        )

    q = db.query(ModeloCanje).filter(ModeloCanje.nombre_modelo.ilike(equipo.modelo.strip()))

    if equipo.capacidad_gb is not None:
        q = q.filter(ModeloCanje.capacidad_gb == equipo.capacidad_gb)

    modelo = q.first()
    if not modelo:
        modelo = (
            db.query(ModeloCanje)
            .filter(ModeloCanje.nombre_modelo.ilike(f"%{equipo.modelo.strip()}%"))
            .first()
        )

    if not modelo:
        raise HTTPException(
            status_code=404,
            detail="No se encontró un modelo de canje compatible con el equipo ofrecido.",
        )

    return modelo


def _resolver_valor_toma(
    db: Session,
    id_modelo_canje: int,
    bateria_porcentaje: int,
) -> Decimal:
    cotizacion = (
        db.query(CotizacionCanje)
        .filter(
            CotizacionCanje.id_modelo_canje == id_modelo_canje,
            CotizacionCanje.activo.is_(True),
            CotizacionCanje.bateria_min <= bateria_porcentaje,
            CotizacionCanje.bateria_max >= bateria_porcentaje,
        )
        .order_by(CotizacionCanje.bateria_min.desc())
        .first()
    )

    if not cotizacion:
        raise HTTPException(
            status_code=404,
            detail="No existe cotización de canje para ese modelo y rango de batería.",
        )

    return Decimal(cotizacion.valor_toma)


def _resolver_valor_toma_opt(
    db: Session,
    id_modelo_canje: int,
    bateria_porcentaje: int,
) -> Decimal | None:
    cotizacion = (
        db.query(CotizacionCanje)
        .filter(
            CotizacionCanje.id_modelo_canje == id_modelo_canje,
            CotizacionCanje.activo.is_(True),
            CotizacionCanje.bateria_min <= bateria_porcentaje,
            CotizacionCanje.bateria_max >= bateria_porcentaje,
        )
        .order_by(CotizacionCanje.bateria_min.desc())
        .first()
    )
    if not cotizacion:
        return None
    return Decimal(cotizacion.valor_toma)


def _cotizar_por_modelo(
    db: Session,
    id_modelo_canje: int,
    bateria_porcentaje: int,
    id_producto_interes: int,
) -> CotizarCanjeResponse:
    if bateria_porcentaje < 0 or bateria_porcentaje > 100:
        return CotizarCanjeResponse(
            codigo_resultado=ResultadoCotizacionCanje.BATERIA_INVALIDA,
            mensaje_usuario="La bateria informada es invalida.",
            aprobado=False,
            bateria_porcentaje=bateria_porcentaje,
            id_producto_interes=id_producto_interes,
        )

    modelo = (
        db.query(ModeloCanje)
        .filter(ModeloCanje.id_modelo_canje == id_modelo_canje, ModeloCanje.activo.is_(True))
        .first()
    )
    if not modelo:
        return CotizarCanjeResponse(
            codigo_resultado=ResultadoCotizacionCanje.MODELO_NO_ENCONTRADO,
            mensaje_usuario="No encontramos ese modelo en el plan canje. Elegi uno del listado.",
            aprobado=False,
            bateria_porcentaje=bateria_porcentaje,
            id_producto_interes=id_producto_interes,
        )

    producto = db.query(Productos).filter(Productos.id == id_producto_interes).first()
    if not producto:
        return CotizarCanjeResponse(
            codigo_resultado=ResultadoCotizacionCanje.PRODUCTO_NO_ENCONTRADO,
            mensaje_usuario="El producto elegido no esta disponible para cotizar.",
            aprobado=False,
            id_modelo_canje=modelo.id_modelo_canje,
            bateria_porcentaje=bateria_porcentaje,
            id_producto_interes=id_producto_interes,
        )

    valor_toma = _resolver_valor_toma_opt(db, modelo.id_modelo_canje, bateria_porcentaje)
    if valor_toma is None:
        return CotizarCanjeResponse(
            codigo_resultado=ResultadoCotizacionCanje.COTIZACION_NO_DISPONIBLE,
            mensaje_usuario="No hay cotizacion disponible para ese rango de bateria en este modelo.",
            aprobado=False,
            id_modelo_canje=modelo.id_modelo_canje,
            bateria_porcentaje=bateria_porcentaje,
            id_producto_interes=id_producto_interes,
            precio_producto_interes=Decimal(producto.precio),
        )

    precio_producto = Decimal(producto.precio)
    diferencia = precio_producto - valor_toma

    if diferencia <= 0:
        return CotizarCanjeResponse(
            codigo_resultado=ResultadoCotizacionCanje.SIN_DIFERENCIA,
            mensaje_usuario="Tu equipo cubre completamente este producto. En plan canje no se genera saldo a favor.",
            aprobado=False,
            id_modelo_canje=modelo.id_modelo_canje,
            bateria_porcentaje=bateria_porcentaje,
            id_producto_interes=id_producto_interes,
            valor_toma=valor_toma,
            precio_producto_interes=precio_producto,
            diferencia_a_pagar=Decimal("0.00"),
        )

    return CotizarCanjeResponse(
        codigo_resultado=ResultadoCotizacionCanje.APROBADO,
        mensaje_usuario="Canje disponible. Ya podes continuar con la solicitud.",
        aprobado=True,
        id_modelo_canje=modelo.id_modelo_canje,
        bateria_porcentaje=bateria_porcentaje,
        id_producto_interes=id_producto_interes,
        valor_toma=valor_toma,
        precio_producto_interes=precio_producto,
        diferencia_a_pagar=diferencia,
    )


def _hay_solapamiento_cotizacion(
    db: Session,
    id_modelo_canje: int,
    bateria_min: int,
    bateria_max: int,
    excluir_id_cotizacion: int | None = None,
) -> bool:
    q = db.query(CotizacionCanje).filter(
        CotizacionCanje.id_modelo_canje == id_modelo_canje,
        CotizacionCanje.bateria_min <= bateria_max,
        CotizacionCanje.bateria_max >= bateria_min,
    )
    if excluir_id_cotizacion is not None:
        q = q.filter(CotizacionCanje.id_cotizacion != excluir_id_cotizacion)
    return q.first() is not None


@router.get("/modelos", response_model=list[ModeloCanjeResponse])
def listar_modelos_canje(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    activo: bool | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(ModeloCanje)
    if activo is not None:
        q = q.filter(ModeloCanje.activo == activo)
    return q.order_by(ModeloCanje.nombre_modelo).offset(skip).limit(limit).all()


@router.post("/modelos", response_model=ModeloCanjeResponse, status_code=status.HTTP_201_CREATED)
def crear_modelo_canje(payload: ModeloCanjeCreate, db: Session = Depends(get_db)):
    nombre = payload.nombre_modelo.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre del modelo es obligatorio")

    existente = (
        db.query(ModeloCanje)
        .filter(
            ModeloCanje.nombre_modelo.ilike(nombre),
            ModeloCanje.capacidad_gb == payload.capacidad_gb,
        )
        .first()
    )
    if existente:
        raise HTTPException(status_code=400, detail="Ese modelo de canje ya existe")

    obj = ModeloCanje(
        nombre_modelo=nombre,
        capacidad_gb=payload.capacidad_gb,
        foto_url=payload.foto_url,
        activo=payload.activo,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/modelos/{id_modelo_canje}", response_model=ModeloCanjeResponse)
def actualizar_modelo_canje(
    id_modelo_canje: int,
    payload: ModeloCanjeUpdate,
    db: Session = Depends(get_db),
):
    obj = db.query(ModeloCanje).filter(ModeloCanje.id_modelo_canje == id_modelo_canje).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Modelo de canje no encontrado")

    cambios = payload.model_dump(exclude_unset=True)
    if "nombre_modelo" in cambios and isinstance(cambios["nombre_modelo"], str):
        cambios["nombre_modelo"] = cambios["nombre_modelo"].strip()
        if not cambios["nombre_modelo"]:
            raise HTTPException(status_code=400, detail="El nombre del modelo es obligatorio")

    for k, v in cambios.items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/modelos/{id_modelo_canje}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_modelo_canje(id_modelo_canje: int, db: Session = Depends(get_db)):
    obj = db.query(ModeloCanje).filter(ModeloCanje.id_modelo_canje == id_modelo_canje).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Modelo de canje no encontrado")

    cotizaciones = (
        db.query(CotizacionCanje)
        .filter(CotizacionCanje.id_modelo_canje == id_modelo_canje)
        .first()
    )
    if cotizaciones:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar el modelo porque tiene cotizaciones asociadas.",
        )

    db.delete(obj)
    db.commit()
    return None


@router.post("/modelos/{id_modelo_canje}/foto", response_model=ModeloCanjeResponse)
async def subir_foto_modelo_canje(
    id_modelo_canje: int,
    foto: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    obj = db.query(ModeloCanje).filter(ModeloCanje.id_modelo_canje == id_modelo_canje).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Modelo de canje no encontrado")

    if not foto.content_type or not foto.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen.")

    ext = Path(foto.filename or "").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        ext = ".jpg"

    rel_dir = Path("canje_modelos") / str(id_modelo_canje)
    abs_dir = UPLOAD_DIR / rel_dir
    abs_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}{ext}"
    abs_path = abs_dir / filename

    content = await foto.read()
    if not content:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen supera 10 MB.")

    abs_path.write_bytes(content)

    obj.foto_url = f"/uploads/{rel_dir.as_posix()}/{filename}"
    db.commit()
    db.refresh(obj)
    return obj


def _calcular_presupuesto(
    db: Session,
    id_equipo_ofrecido: int,
    id_producto_interes: int,
) -> PresupuestoCanjeResponse:
    equipo = (
        db.query(EquipoOfrecidoCanje)
        .filter(EquipoOfrecidoCanje.id_equipo_ofrecido == id_equipo_ofrecido)
        .first()
    )
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo ofrecido no encontrado")

    if equipo.bateria_porcentaje is None:
        raise HTTPException(
            status_code=400,
            detail="El equipo ofrecido debe informar batería para cotizar el canje.",
        )

    producto = db.query(Productos).filter(Productos.id == id_producto_interes).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto de interés no encontrado")

    modelo = _resolver_modelo_equipo_ofrecido(db, equipo)
    valor_toma = _resolver_valor_toma(db, modelo.id_modelo_canje, equipo.bateria_porcentaje)
    precio_producto = Decimal(producto.precio)

    diferencia = precio_producto - valor_toma
    if diferencia <= 0:
        return PresupuestoCanjeResponse(
            id_equipo_ofrecido=id_equipo_ofrecido,
            id_producto_interes=id_producto_interes,
            id_modelo_canje=modelo.id_modelo_canje,
            bateria_porcentaje=equipo.bateria_porcentaje,
            valor_toma=valor_toma,
            precio_producto_interes=precio_producto,
            diferencia_a_pagar=Decimal("0.00"),
            aprobado=False,
            motivo_rechazo=(
                "El canje solo aplica a productos de mayor valor que el equipo ofrecido."
            ),
        )

    return PresupuestoCanjeResponse(
        id_equipo_ofrecido=id_equipo_ofrecido,
        id_producto_interes=id_producto_interes,
        id_modelo_canje=modelo.id_modelo_canje,
        bateria_porcentaje=equipo.bateria_porcentaje,
        valor_toma=valor_toma,
        precio_producto_interes=precio_producto,
        diferencia_a_pagar=diferencia,
        aprobado=True,
        motivo_rechazo=None,
    )


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


@router.get("/cotizaciones", response_model=list[CotizacionCanjeResponse])
def listar_cotizaciones_canje(
    id_modelo_canje: int | None = Query(None),
    activo: bool | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(CotizacionCanje)
    if id_modelo_canje is not None:
        q = q.filter(CotizacionCanje.id_modelo_canje == id_modelo_canje)
    if activo is not None:
        q = q.filter(CotizacionCanje.activo == activo)
    return q.order_by(CotizacionCanje.id_modelo_canje, CotizacionCanje.bateria_min).all()


@router.post(
    "/cotizaciones",
    response_model=CotizacionCanjeResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_cotizacion_canje(payload: CotizacionCanjeCreate, db: Session = Depends(get_db)):
    modelo = (
        db.query(ModeloCanje)
        .filter(ModeloCanje.id_modelo_canje == payload.id_modelo_canje)
        .first()
    )
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo de canje no encontrado")

    existente = (
        db.query(CotizacionCanje)
        .filter(
            CotizacionCanje.id_modelo_canje == payload.id_modelo_canje,
            CotizacionCanje.bateria_min == payload.bateria_min,
            CotizacionCanje.bateria_max == payload.bateria_max,
        )
        .first()
    )
    if existente:
        raise HTTPException(
            status_code=400,
            detail="Ya existe una cotización para ese modelo y rango de batería.",
        )

    if _hay_solapamiento_cotizacion(
        db,
        id_modelo_canje=payload.id_modelo_canje,
        bateria_min=payload.bateria_min,
        bateria_max=payload.bateria_max,
    ):
        raise HTTPException(
            status_code=400,
            detail="Ya existe una cotización con rango de batería superpuesto para ese modelo.",
        )

    obj = CotizacionCanje(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/cotizaciones/{id_cotizacion}", response_model=CotizacionCanjeResponse)
def actualizar_cotizacion_canje(
    id_cotizacion: int,
    payload: CotizacionCanjeUpdate,
    db: Session = Depends(get_db),
):
    obj = db.query(CotizacionCanje).filter(CotizacionCanje.id_cotizacion == id_cotizacion).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")

    cambios = payload.model_dump(exclude_unset=True)
    for k, v in cambios.items():
        setattr(obj, k, v)

    if obj.bateria_min > obj.bateria_max:
        raise HTTPException(status_code=400, detail="bateria_min no puede ser mayor que bateria_max")

    if _hay_solapamiento_cotizacion(
        db,
        id_modelo_canje=obj.id_modelo_canje,
        bateria_min=obj.bateria_min,
        bateria_max=obj.bateria_max,
        excluir_id_cotizacion=obj.id_cotizacion,
    ):
        raise HTTPException(
            status_code=400,
            detail="Ya existe una cotización con rango de batería superpuesto para ese modelo.",
        )

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/cotizaciones/{id_cotizacion}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_cotizacion_canje(id_cotizacion: int, db: Session = Depends(get_db)):
    obj = db.query(CotizacionCanje).filter(CotizacionCanje.id_cotizacion == id_cotizacion).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    db.delete(obj)
    db.commit()
    return None


@router.post("/presupuesto", response_model=PresupuestoCanjeResponse)
def calcular_presupuesto_canje(payload: PresupuestoCanjeRequest, db: Session = Depends(get_db)):
    return _calcular_presupuesto(
        db,
        id_equipo_ofrecido=payload.id_equipo_ofrecido,
        id_producto_interes=payload.id_producto_interes,
    )


@router.post("/cotizar", response_model=CotizarCanjeResponse)
def cotizar_plan_canje(payload: CotizarCanjeRequest, db: Session = Depends(get_db)):
    return _cotizar_por_modelo(
        db,
        id_modelo_canje=payload.id_modelo_canje,
        bateria_porcentaje=payload.bateria_porcentaje,
        id_producto_interes=payload.id_producto_interes,
    )


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

    presupuesto = _calcular_presupuesto(
        db,
        id_equipo_ofrecido=data["id_equipo_ofrecido"],
        id_producto_interes=data["id_producto_interes"],
    )
    if not presupuesto.aprobado:
        raise HTTPException(status_code=400, detail=presupuesto.motivo_rechazo)

    data["valor_estimado"] = presupuesto.valor_toma
    data["diferencia_a_pagar"] = presupuesto.diferencia_a_pagar

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
