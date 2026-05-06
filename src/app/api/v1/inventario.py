"""
Módulo INVENTARIO DE EQUIPOS (mi alcance).
Solo: modelos de equipo, equipos, detalle usados, depósitos, equipo-depósito.
No incluye: catálogo productos, pedidos ni pagos (los hace el compañero).
"""
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.exc import IntegrityError, ProgrammingError
from sqlalchemy.orm import Session, joinedload

from app.config import UPLOAD_DIR
from app.db import get_db
from app.models import (
    ModeloEquipo,
    ModeloAtributo,
    ModeloAtributoOpcion,
    Equipo,
    EquipoConfiguracion,
    EquipoUsadoDetalle,
    Deposito,
    EquipoDeposito,
    Productos,
    CategoriaProducto,
)
from app.schemas.inventario import (
    ModeloEquipoCreate,
    ModeloEquipoUpdate,
    ModeloEquipoResponse,
    ModeloAtributoCreate,
    ModeloAtributoUpdate,
    ModeloAtributoResponse,
    ModeloAtributoOpcionCreate,
    ModeloAtributoOpcionUpdate,
    ModeloAtributoOpcionResponse,
    EquipoCreate,
    EquipoUpdate,
    EquipoResponse,
    EquipoConModeloResponse,
    EquipoUsadoDetalleCreate,
    EquipoUsadoDetalleUpdate,
    EquipoUsadoDetalleResponse,
    DepositoCreate,
    DepositoUpdate,
    DepositoResponse,
    EquipoDepositoCreate,
    EquipoDepositoUpdate,
    EquipoDepositoResponse,
)

router = APIRouter()


def _is_missing_variaciones_table(exc: Exception) -> bool:
    text = str(exc).lower()
    return (
        "modelo_atributo" in text
        or "modelo_atributo_opcion" in text
        or "equipo_configuracion" in text
    )


def _equipo_configuracion_payload(eq: Equipo) -> list[dict]:
    out: list[dict] = []
    for cfg in getattr(eq, "configuraciones", []) or []:
        atributo = getattr(cfg, "atributo", None)
        opcion = getattr(cfg, "opcion", None)
        out.append(
            {
                "id": int(cfg.id),
                "id_equipo": int(cfg.id_equipo),
                "id_atributo": int(cfg.id_atributo),
                "id_opcion": int(cfg.id_opcion),
                "atributo_code": getattr(atributo, "code", None),
                "atributo_label": getattr(atributo, "label", None),
                "opcion_valor": getattr(opcion, "valor", None),
                "opcion_label": getattr(opcion, "label", None),
            }
        )
    out.sort(key=lambda x: ((x.get("atributo_code") or ""), x["id"]))
    return out


def _equipo_response_payload(eq: Equipo) -> dict:
    return {
        "id": int(eq.id),
        "id_modelo": int(eq.id_modelo),
        "imei": eq.imei,
        "color": eq.color,
        "tipo_equipo": eq.tipo_equipo,
        "estado_comercial": eq.estado_comercial,
        "activo": bool(eq.activo),
        "id_producto": eq.id_producto,
        "foto_url": eq.foto_url,
        "fecha_ingreso": eq.fecha_ingreso,
        "configuracion": _equipo_configuracion_payload(eq),
    }


def _modelo_response_payload(modelo: ModeloEquipo, *, atributos: list[dict] | None = None) -> dict:
    return {
        "id": int(modelo.id),
        "nombre_modelo": modelo.nombre_modelo,
        "capacidad_gb": modelo.capacidad_gb,
        "descripcion": getattr(modelo, "descripcion", None),
        "activo": bool(modelo.activo),
        "atributos": atributos or [],
    }


def _atributo_response_payload(attr: ModeloAtributo) -> dict:
    return {
        "id": int(attr.id),
        "id_modelo": int(attr.id_modelo),
        "code": attr.code,
        "label": attr.label,
        "tipo_ui": attr.tipo_ui,
        "requerido": bool(attr.requerido),
        "orden": int(attr.orden or 0),
        "activo": bool(attr.activo),
        "opciones": [
            {
                "id": int(op.id),
                "id_atributo": int(op.id_atributo),
                "valor": op.valor,
                "label": op.label,
                "color_hex": op.color_hex,
                "orden": int(op.orden or 0),
                "activo": bool(op.activo),
            }
            for op in (attr.opciones or [])
        ],
    }


def _equipo_con_modelo_payload(eq: Equipo, *, modelo_atributos: list[dict] | None = None) -> dict:
    base = _equipo_response_payload(eq)
    modelo = getattr(eq, "modelo", None)
    if modelo is not None:
        base["modelo"] = _modelo_response_payload(modelo, atributos=modelo_atributos or [])
    else:
        base["modelo"] = {
            "id": int(eq.id_modelo),
            "nombre_modelo": "—",
            "capacidad_gb": None,
            "descripcion": None,
            "activo": True,
            "atributos": [],
        }
    return base


def _descripcion_catalogo_normalizada(texto: str | None) -> str | None:
    t = (texto or "").strip()
    if not t:
        return None
    if t.lower() == "producto autogenerado desde inventario":
        return None
    return t


def _foto_url_si_existe(foto_url: str | None) -> str | None:
    if not foto_url:
        return None
    path = foto_url.strip()
    if not path.startswith("/uploads/"):
        return path
    rel = path[len("/uploads/") :]
    abs_path = UPLOAD_DIR / rel
    return path if abs_path.exists() else None


def _clonar_producto_para_equipo_usado(
    db: Session,
    *,
    producto_base: Productos,
    nombre_producto: str,
    precio_ars: Decimal | None,
    precio_usd: Decimal | None,
) -> Productos:
    nuevo_producto = Productos(
        nombre=nombre_producto,
        descripcion=producto_base.descripcion,
        precio=Decimal(str(precio_ars)) if precio_ars is not None else producto_base.precio,
        precio_usd=Decimal(str(precio_usd)) if precio_usd is not None else producto_base.precio_usd,
        id_categoria=producto_base.id_categoria,
        activo=True,
    )
    db.add(nuevo_producto)
    db.flush()
    return nuevo_producto


@router.get("/modelos", response_model=list[ModeloEquipoResponse])
def listar_modelos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    try:
        return (
            db.query(ModeloEquipo)
            .options(joinedload(ModeloEquipo.atributos).joinedload(ModeloAtributo.opciones))
            .offset(skip)
            .limit(limit)
            .all()
        )
    except ProgrammingError as exc:
        db.rollback()
        if not _is_missing_variaciones_table(exc):
            raise
        rows = db.query(ModeloEquipo).offset(skip).limit(limit).all()
        return [_modelo_response_payload(r, atributos=[]) for r in rows]


@router.post("/modelos", response_model=ModeloEquipoResponse, status_code=status.HTTP_201_CREATED)
def crear_modelo(payload: ModeloEquipoCreate, db: Session = Depends(get_db)):
    # `ModeloEquipoCreate` incluye `descripcion` por compatibilidad con el frontend,
    # pero la tabla `modelos_equipo` no tiene esa columna.
    data = payload.model_dump(exclude={"descripcion"})
    obj = ModeloEquipo(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/modelos/{id_modelo}", response_model=ModeloEquipoResponse)
def obtener_modelo(id_modelo: int, db: Session = Depends(get_db)):
    try:
        obj = (
            db.query(ModeloEquipo)
            .options(joinedload(ModeloEquipo.atributos).joinedload(ModeloAtributo.opciones))
            .filter(ModeloEquipo.id == id_modelo)
            .first()
        )
    except ProgrammingError as exc:
        db.rollback()
        if not _is_missing_variaciones_table(exc):
            raise
        obj = db.query(ModeloEquipo).filter(ModeloEquipo.id == id_modelo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    try:
        return _modelo_response_payload(obj, atributos=[_atributo_response_payload(a) for a in list(obj.atributos or [])])
    except Exception:
        return _modelo_response_payload(obj, atributos=[])


@router.patch("/modelos/{id_modelo}", response_model=ModeloEquipoResponse)
def actualizar_modelo(id_modelo: int, payload: ModeloEquipoUpdate, db: Session = Depends(get_db)):
    try:
        obj = (
            db.query(ModeloEquipo)
            .options(joinedload(ModeloEquipo.atributos).joinedload(ModeloAtributo.opciones))
            .filter(ModeloEquipo.id == id_modelo)
            .first()
        )
    except ProgrammingError as exc:
        db.rollback()
        if not _is_missing_variaciones_table(exc):
            raise
        obj = db.query(ModeloEquipo).filter(ModeloEquipo.id == id_modelo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")

    patch = payload.model_dump(exclude_unset=True)
    patch.pop("descripcion", None)
    for k, v in patch.items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return _modelo_response_payload(obj, atributos=[])


@router.delete("/modelos/{id_modelo}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_modelo(id_modelo: int, db: Session = Depends(get_db)):
    obj = db.query(ModeloEquipo).filter(ModeloEquipo.id == id_modelo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    equipos_asociados = db.query(Equipo).filter(Equipo.id_modelo == id_modelo).count()
    if equipos_asociados > 0:
      raise HTTPException(
            status_code=409,
            detail=(
                f"No se puede eliminar el modelo porque tiene {equipos_asociados} equipo(s) asociado(s). "
                "Primero reasigná o eliminá esos equipos."
            ),
        )
    db.delete(obj)
    db.commit()
    return None


@router.get("/modelos/{id_modelo}/atributos", response_model=list[ModeloAtributoResponse])
def listar_modelo_atributos(id_modelo: int, db: Session = Depends(get_db)):
    modelo = db.query(ModeloEquipo).filter(ModeloEquipo.id == id_modelo).first()
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    try:
        return (
            db.query(ModeloAtributo)
            .options(joinedload(ModeloAtributo.opciones))
            .filter(ModeloAtributo.id_modelo == id_modelo)
            .order_by(ModeloAtributo.orden.asc(), ModeloAtributo.id.asc())
            .all()
        )
    except ProgrammingError as exc:
        db.rollback()
        if _is_missing_variaciones_table(exc):
            return []
        raise


@router.post(
    "/modelos/{id_modelo}/atributos",
    response_model=ModeloAtributoResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_modelo_atributo(
    id_modelo: int,
    payload: ModeloAtributoCreate,
    db: Session = Depends(get_db),
):
    modelo = db.query(ModeloEquipo).filter(ModeloEquipo.id == id_modelo).first()
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    try:
        obj = ModeloAtributo(id_modelo=id_modelo, **payload.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj
    except ProgrammingError as exc:
        db.rollback()
        if _is_missing_variaciones_table(exc):
            raise HTTPException(
                status_code=400,
                detail="Faltan tablas de variaciones. Ejecutá `alembic upgrade head` y reiniciá backend.",
            )
        raise


@router.patch("/modelos/atributos/{id_atributo}", response_model=ModeloAtributoResponse)
def actualizar_modelo_atributo(
    id_atributo: int,
    payload: ModeloAtributoUpdate,
    db: Session = Depends(get_db),
):
    obj = (
        db.query(ModeloAtributo)
        .options(joinedload(ModeloAtributo.opciones))
        .filter(ModeloAtributo.id == id_atributo)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Atributo no encontrado")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/modelos/atributos/{id_atributo}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_modelo_atributo(id_atributo: int, db: Session = Depends(get_db)):
    obj = db.query(ModeloAtributo).filter(ModeloAtributo.id == id_atributo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Atributo no encontrado")
    db.query(EquipoConfiguracion).filter(EquipoConfiguracion.id_atributo == id_atributo).delete(
        synchronize_session=False,
    )
    db.query(ModeloAtributoOpcion).filter(ModeloAtributoOpcion.id_atributo == id_atributo).delete(
        synchronize_session=False,
    )
    db.delete(obj)
    db.commit()
    return None


@router.post(
    "/modelos/atributos/{id_atributo}/opciones",
    response_model=ModeloAtributoOpcionResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_modelo_atributo_opcion(
    id_atributo: int,
    payload: ModeloAtributoOpcionCreate,
    db: Session = Depends(get_db),
):
    atributo = db.query(ModeloAtributo).filter(ModeloAtributo.id == id_atributo).first()
    if not atributo:
        raise HTTPException(status_code=404, detail="Atributo no encontrado")
    try:
        obj = ModeloAtributoOpcion(id_atributo=id_atributo, **payload.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj
    except ProgrammingError as exc:
        db.rollback()
        if _is_missing_variaciones_table(exc):
            raise HTTPException(
                status_code=400,
                detail="Faltan tablas de variaciones. Ejecutá `alembic upgrade head` y reiniciá backend.",
            )
        raise


@router.patch("/modelos/opciones/{id_opcion}", response_model=ModeloAtributoOpcionResponse)
def actualizar_modelo_atributo_opcion(
    id_opcion: int,
    payload: ModeloAtributoOpcionUpdate,
    db: Session = Depends(get_db),
):
    obj = db.query(ModeloAtributoOpcion).filter(ModeloAtributoOpcion.id == id_opcion).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Opción no encontrada")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/modelos/opciones/{id_opcion}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_modelo_atributo_opcion(id_opcion: int, db: Session = Depends(get_db)):
    obj = db.query(ModeloAtributoOpcion).filter(ModeloAtributoOpcion.id == id_opcion).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Opción no encontrada")
    db.query(EquipoConfiguracion).filter(EquipoConfiguracion.id_opcion == id_opcion).delete(
        synchronize_session=False,
    )
    db.delete(obj)
    db.commit()
    return None


@router.get("/equipos", response_model=list[EquipoConModeloResponse])
def listar_equipos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Lista equipos trayendo en la misma consulta el modelo (join)."""
    variaciones_disponibles = True
    try:
        rows = (
            db.query(Equipo)
            .options(
                joinedload(Equipo.modelo),
                joinedload(Equipo.configuraciones).joinedload(EquipoConfiguracion.atributo),
                joinedload(Equipo.configuraciones).joinedload(EquipoConfiguracion.opcion),
            )
            .offset(skip)
            .limit(limit)
            .all()
        )
    except ProgrammingError as exc:
        db.rollback()
        if not _is_missing_variaciones_table(exc):
            raise
        variaciones_disponibles = False
        rows = db.query(Equipo).options(joinedload(Equipo.modelo)).offset(skip).limit(limit).all()
    for row in rows:
        row.foto_url = _foto_url_si_existe(row.foto_url)
    return [
        _equipo_con_modelo_payload(
            row,
            modelo_atributos=[] if not variaciones_disponibles else None,
        )
        for row in rows
    ]


@router.post("/equipos", response_model=EquipoResponse, status_code=status.HTTP_201_CREATED)
def crear_equipo(payload: EquipoCreate, db: Session = Depends(get_db)):
    return _crear_equipo_con_estado(payload, db, estado_forzado="nuevo")


@router.post("/equipos-usados", response_model=EquipoResponse, status_code=status.HTTP_201_CREATED)
def crear_equipo_usado(payload: EquipoCreate, db: Session = Depends(get_db)):
    return _crear_equipo_con_estado(payload, db, estado_forzado="usado")


def _crear_equipo_con_estado(payload: EquipoCreate, db: Session, *, estado_forzado: str):
    data = payload.model_dump()
    data["estado_comercial"] = estado_forzado
    validar_atributos_requeridos = estado_forzado != "usado"
    opciones_ids = [int(x) for x in (data.pop("opciones_configuracion_ids", []) or []) if int(x) > 0]
    capacidad_gb_input = data.pop("capacidad_gb", None)
    if data.get("fecha_ingreso") is None:
        data["fecha_ingreso"] = datetime.now(timezone.utc)

    modelo = db.query(ModeloEquipo).filter(ModeloEquipo.id == data["id_modelo"]).first()
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    if estado_forzado == "usado" and capacidad_gb_input is not None:
        capacidad_gb_val = int(capacidad_gb_input)
        if capacidad_gb_val > 0 and modelo.capacidad_gb != capacidad_gb_val:
            modelo.capacidad_gb = capacidad_gb_val
            db.flush()
    atributos_requeridos = []
    try:
        atributos_requeridos = (
            db.query(ModeloAtributo)
            .filter(
                ModeloAtributo.id_modelo == int(modelo.id),
                ModeloAtributo.requerido.is_(True),
                ModeloAtributo.activo.is_(True),
            )
            .all()
        )
    except ProgrammingError as exc:
        db.rollback()
        if _is_missing_variaciones_table(exc):
            if opciones_ids:
                raise HTTPException(
                    status_code=400,
                    detail="No se pueden guardar variaciones: falta migración (`alembic upgrade head`).",
                )
            atributos_requeridos = []
        else:
            raise

    precio_ars = data.pop("precio_ars", None)
    precio_usd = data.pop("precio_usd", None)

    if data.get("id_producto") is not None:
        prod = db.query(Productos).filter(Productos.id == data["id_producto"]).first()
        if not prod:
            raise HTTPException(
                status_code=400,
                detail="El ID producto no existe en catálogo (productos).",
            )
        # Si entra una unidad física disponible, el producto debe volver a mostrarse.
        if not bool(prod.activo):
            prod.activo = True
        if precio_ars is not None:
            prod.precio = Decimal(str(precio_ars))
        if precio_usd is not None:
            prod.precio_usd = Decimal(str(precio_usd))
        db.flush()
    else:
        capacidad = f"{modelo.capacidad_gb}GB" if modelo.capacidad_gb is not None else "s/capacidad"
        color_equipo = (data.get("color") or "").strip()
        color = (color_equipo or getattr(modelo, "color", None) or "sin color").strip()
        estado_comercial = (data.get("estado_comercial") or "").strip().lower()
        estado_suffix = "Usado" if estado_comercial == "usado" else "Nuevo"
        nombre_producto = f"{modelo.nombre_modelo} - {capacidad} - {color} - {estado_suffix}"

        categoria = (
            db.query(CategoriaProducto)
            .filter(CategoriaProducto.nombre.ilike("%smartphone%"), CategoriaProducto.activo.is_(True))
            .first()
        )
        if not categoria:
            categoria = db.query(CategoriaProducto).filter(CategoriaProducto.activo.is_(True)).first()
        if not categoria:
            categoria = CategoriaProducto(nombre="Smartphones", descripcion="Autogenerada por inventario", activo=True)
            db.add(categoria)
            db.flush()

        # Para equipos usados, cada alta debe crear su propio producto para no
        # pisar precio/stock de equipos nuevos (y viceversa).
        producto = None
        if estado_comercial != "usado":
            producto = (
                db.query(Productos)
                .filter(Productos.id_categoria == categoria.id, Productos.nombre == nombre_producto)
                .first()
            )
        if not producto:
            producto = Productos(
                nombre=nombre_producto,
                descripcion=None,
                precio=Decimal(str(precio_ars)) if precio_ars is not None else Decimal("0.00"),
                precio_usd=Decimal(str(precio_usd)) if precio_usd is not None else None,
                id_categoria=categoria.id,
                activo=True,
            )
            db.add(producto)
            db.flush()
        elif not bool(producto.activo):
            # Reusar producto existente para nuevos implica volver a habilitar catálogo.
            producto.activo = True

        data["id_producto"] = producto.id

    obj = Equipo(**data)
    db.add(obj)
    db.flush()
    if opciones_ids:
        try:
            opciones = (
                db.query(ModeloAtributoOpcion)
                .join(ModeloAtributo, ModeloAtributo.id == ModeloAtributoOpcion.id_atributo)
                .filter(
                    ModeloAtributoOpcion.id.in_(opciones_ids),
                    ModeloAtributo.id_modelo == int(modelo.id),
                    ModeloAtributoOpcion.activo.is_(True),
                    ModeloAtributo.activo.is_(True),
                )
                .all()
            )
        except ProgrammingError as exc:
            db.rollback()
            if _is_missing_variaciones_table(exc):
                raise HTTPException(
                    status_code=400,
                    detail="No se pueden guardar variaciones: falta migración (`alembic upgrade head`).",
                )
            raise
        if len(opciones) != len(set(opciones_ids)):
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Una o más opciones de configuración no pertenecen al modelo o están inactivas.",
            )
        seen_attr: set[int] = set()
        for op_item in opciones:
            attr_id = int(op_item.id_atributo)
            if attr_id in seen_attr:
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail="No podés elegir más de una opción para el mismo atributo.",
                )
            seen_attr.add(attr_id)
            db.add(
                EquipoConfiguracion(
                    id_equipo=int(obj.id),
                    id_atributo=attr_id,
                    id_opcion=int(op_item.id),
                )
            )
        db.flush()
    req_ids = {int(a.id) for a in atributos_requeridos} if validar_atributos_requeridos else set()
    cfg_req_ids: set[int] = set()
    if req_ids:
        try:
            cfg_req_ids = {
                int(cfg.id_atributo)
                for cfg in db.query(EquipoConfiguracion).filter(EquipoConfiguracion.id_equipo == int(obj.id)).all()
            }
        except ProgrammingError as exc:
            db.rollback()
            if _is_missing_variaciones_table(exc):
                raise HTTPException(
                    status_code=400,
                    detail="No se pueden validar variaciones: falta migración (`alembic upgrade head`).",
                )
            raise
    if req_ids and not req_ids.issubset(cfg_req_ids):
        faltantes = sorted(req_ids - cfg_req_ids)
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Faltan opciones requeridas para atributos del modelo: {faltantes}.",
        )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo guardar el equipo. Revisá IMEI único e ID producto válido.",
        )
    obj = (
        db.query(Equipo)
        .options(
            joinedload(Equipo.configuraciones).joinedload(EquipoConfiguracion.atributo),
            joinedload(Equipo.configuraciones).joinedload(EquipoConfiguracion.opcion),
            joinedload(Equipo.modelo),
        )
        .filter(Equipo.id == int(obj.id))
        .first()
    )
    assert obj is not None
    return _equipo_response_payload(obj)


@router.get("/equipos/{id_equipo}", response_model=EquipoConModeloResponse)
def obtener_equipo(id_equipo: int, db: Session = Depends(get_db)):
    """Obtiene un equipo con su modelo en la misma consulta (join)."""
    variaciones_disponibles = True
    try:
        obj = (
            db.query(Equipo)
            .options(
                joinedload(Equipo.modelo),
                joinedload(Equipo.configuraciones).joinedload(EquipoConfiguracion.atributo),
                joinedload(Equipo.configuraciones).joinedload(EquipoConfiguracion.opcion),
            )
            .filter(Equipo.id == id_equipo)
            .first()
        )
    except ProgrammingError as exc:
        db.rollback()
        if not _is_missing_variaciones_table(exc):
            raise
        variaciones_disponibles = False
        obj = db.query(Equipo).options(joinedload(Equipo.modelo)).filter(Equipo.id == id_equipo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    obj.foto_url = _foto_url_si_existe(obj.foto_url)
    return _equipo_con_modelo_payload(obj, modelo_atributos=[] if not variaciones_disponibles else None)


@router.patch("/equipos/{id_equipo}", response_model=EquipoResponse)
def actualizar_equipo(id_equipo: int, payload: EquipoUpdate, db: Session = Depends(get_db)):
    obj = db.query(Equipo).filter(Equipo.id == id_equipo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    patch = payload.model_dump(exclude_unset=True)
    precio_ars = patch.pop("precio_ars", None)
    precio_usd = patch.pop("precio_usd", None)
    opciones_ids_input = patch.pop("opciones_configuracion_ids", None)
    if "id_producto" in patch and patch["id_producto"] is not None:
        prod = db.query(Productos).filter(Productos.id == patch["id_producto"]).first()
        if not prod:
            raise HTTPException(
                status_code=400,
                detail="El ID producto no existe en catálogo (productos).",
            )

    for k, v in patch.items():
        setattr(obj, k, v)

    if precio_ars is not None or precio_usd is not None:
        prod_id = patch.get("id_producto", obj.id_producto)
        if prod_id is None:
            raise HTTPException(
                status_code=400,
                detail="No se puede setear precio: el equipo no tiene id_producto asociado.",
            )
        prod = db.query(Productos).filter(Productos.id == prod_id).first()
        if not prod:
            raise HTTPException(
                status_code=400,
                detail="El ID producto no existe en catálogo (productos).",
            )

        estado_objetivo = (patch.get("estado_comercial", obj.estado_comercial) or "").strip().lower()
        # Si el equipo es usado, forzamos producto propio para no mezclar
        # precios con "nuevos" u otros usados históricos.
        if estado_objetivo == "usado":
            capacidad = (
                f"{obj.modelo.capacidad_gb}GB"
                if obj.modelo and obj.modelo.capacidad_gb is not None
                else "s/capacidad"
            )
            color = ((patch.get("color", obj.color) or getattr(obj.modelo, "color", None) or "sin color")).strip()
            nombre_producto = f"{obj.modelo.nombre_modelo if obj.modelo else 'Equipo'} - {capacidad} - {color} - Usado"
            nuevo_prod = _clonar_producto_para_equipo_usado(
                db,
                producto_base=prod,
                nombre_producto=nombre_producto,
                precio_ars=precio_ars,
                precio_usd=precio_usd,
            )
            obj.id_producto = nuevo_prod.id
            prod = nuevo_prod

        if precio_ars is not None:
            prod.precio = Decimal(str(precio_ars))
        if precio_usd is not None:
            prod.precio_usd = Decimal(str(precio_usd))

    if opciones_ids_input is not None:
        opciones_ids = [int(x) for x in opciones_ids_input if int(x) > 0]
        if opciones_ids:
            try:
                opciones = (
                    db.query(ModeloAtributoOpcion)
                    .join(ModeloAtributo, ModeloAtributo.id == ModeloAtributoOpcion.id_atributo)
                    .filter(
                        ModeloAtributoOpcion.id.in_(opciones_ids),
                        ModeloAtributo.id_modelo == int(obj.id_modelo),
                        ModeloAtributoOpcion.activo.is_(True),
                        ModeloAtributo.activo.is_(True),
                    )
                    .all()
                )
            except ProgrammingError as exc:
                db.rollback()
                if _is_missing_variaciones_table(exc):
                    raise HTTPException(
                        status_code=400,
                        detail="No se pueden actualizar variaciones: falta migración (`alembic upgrade head`).",
                    )
                raise
            if len(opciones) != len(set(opciones_ids)):
                raise HTTPException(
                    status_code=400,
                    detail="Una o más opciones de configuración no pertenecen al modelo o están inactivas.",
                )
            seen_attr: set[int] = set()
            for op_item in opciones:
                attr_id = int(op_item.id_atributo)
                if attr_id in seen_attr:
                    raise HTTPException(
                        status_code=400,
                        detail="No podés elegir más de una opción para el mismo atributo.",
                    )
                seen_attr.add(attr_id)

        try:
            db.query(EquipoConfiguracion).filter(EquipoConfiguracion.id_equipo == int(obj.id)).delete(
                synchronize_session=False
            )
        except ProgrammingError as exc:
            db.rollback()
            if _is_missing_variaciones_table(exc):
                raise HTTPException(
                    status_code=400,
                    detail="No se pueden actualizar variaciones: falta migración (`alembic upgrade head`).",
                )
            raise
        for op_item in opciones if opciones_ids else []:
            db.add(
                EquipoConfiguracion(
                    id_equipo=int(obj.id),
                    id_atributo=int(op_item.id_atributo),
                    id_opcion=int(op_item.id),
                )
            )

    # Si el equipo sigue en "nuevo" y cambian atributos comerciales (p. ej. color),
    # lo re-vinculamos al producto canónico de esa variante para evitar que quede
    # separado en el agrupado de inventario/tienda.
    estado_objetivo = (patch.get("estado_comercial", obj.estado_comercial) or "").strip().lower()
    if estado_objetivo != "usado" and "id_producto" not in patch:
        cambio_variante = any(k in patch for k in ("color", "id_modelo", "estado_comercial"))
        if cambio_variante and obj.modelo is not None:
            capacidad = (
                f"{obj.modelo.capacidad_gb}GB"
                if obj.modelo.capacidad_gb is not None
                else "s/capacidad"
            )
            color_objetivo = (
                (patch.get("color", obj.color) or getattr(obj.modelo, "color", None) or "sin color")
                .strip()
            )
            nombre_producto = f"{obj.modelo.nombre_modelo} - {capacidad} - {color_objetivo} - Nuevo"

            # Priorizamos categoría actual del producto vinculado para mantener consistencia.
            categoria_id = None
            if obj.id_producto is not None:
                prod_actual = db.query(Productos).filter(Productos.id == obj.id_producto).first()
                if prod_actual is not None:
                    categoria_id = prod_actual.id_categoria
            if categoria_id is None:
                categoria = (
                    db.query(CategoriaProducto)
                    .filter(CategoriaProducto.nombre.ilike("%smartphone%"), CategoriaProducto.activo.is_(True))
                    .first()
                )
                if not categoria:
                    categoria = db.query(CategoriaProducto).filter(CategoriaProducto.activo.is_(True)).first()
                if categoria is None:
                    categoria = CategoriaProducto(
                        nombre="Smartphones",
                        descripcion="Autogenerada por inventario",
                        activo=True,
                    )
                    db.add(categoria)
                    db.flush()
                categoria_id = categoria.id

            producto_canonico = (
                db.query(Productos)
                .filter(
                    Productos.id_categoria == categoria_id,
                    Productos.nombre == nombre_producto,
                )
                .first()
            )

            if producto_canonico is None:
                # Si no existe la variante comercial, la creamos heredando precios del producto actual.
                base_prod = None
                if obj.id_producto is not None:
                    base_prod = db.query(Productos).filter(Productos.id == obj.id_producto).first()
                producto_canonico = Productos(
                    nombre=nombre_producto,
                    descripcion=_descripcion_catalogo_normalizada(base_prod.descripcion) if base_prod is not None else None,
                    precio=(
                        Decimal(str(precio_ars))
                        if precio_ars is not None
                        else (base_prod.precio if base_prod is not None else Decimal("0.00"))
                    ),
                    precio_usd=(
                        Decimal(str(precio_usd))
                        if precio_usd is not None
                        else (base_prod.precio_usd if base_prod is not None else None)
                    ),
                    id_categoria=categoria_id,
                    activo=True,
                )
                db.add(producto_canonico)
                db.flush()
            elif not bool(producto_canonico.activo):
                producto_canonico.activo = True

            obj.id_producto = producto_canonico.id

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo actualizar el equipo. Revisá IMEI único e ID producto válido.",
        )
    obj = (
        db.query(Equipo)
        .options(
            joinedload(Equipo.modelo),
            joinedload(Equipo.configuraciones).joinedload(EquipoConfiguracion.atributo),
            joinedload(Equipo.configuraciones).joinedload(EquipoConfiguracion.opcion),
        )
        .filter(Equipo.id == id_equipo)
        .first()
    )
    assert obj is not None
    return _equipo_response_payload(obj)


@router.delete("/equipos/{id_equipo}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_equipo(id_equipo: int, db: Session = Depends(get_db)):
    obj = db.query(Equipo).filter(Equipo.id == id_equipo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    # Limpiamos primero relaciones hijas para evitar violaciones de FK
    # cuando la base no tiene ON DELETE CASCADE.
    (
        db.query(EquipoDeposito)
        .filter(EquipoDeposito.id_equipo == id_equipo)
        .delete(synchronize_session=False)
    )
    (
        db.query(EquipoUsadoDetalle)
        .filter(EquipoUsadoDetalle.id_equipo == id_equipo)
        .delete(synchronize_session=False)
    )
    db.delete(obj)
    db.commit()
    return None


@router.post("/equipos/{id_equipo}/foto", response_model=EquipoResponse)
async def subir_foto_equipo(
    id_equipo: int,
    foto: UploadFile = File(...),
    set_principal_tienda: bool = Query(False),
    db: Session = Depends(get_db),
):
    obj = db.query(Equipo).filter(Equipo.id == id_equipo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    if not foto.content_type or not foto.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen.")

    ext = Path(foto.filename or "").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        # Si no viene extensión o viene rara, intentamos default a .jpg
        ext = ".jpg"

    rel_dir = Path("equipos") / str(id_equipo)
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
    if obj.producto is not None:
        foto_principal_actual = getattr(obj.producto, "foto_principal_url", None)
        if set_principal_tienda or not foto_principal_actual:
            obj.producto.foto_principal_url = obj.foto_url
    db.commit()
    obj = (
        db.query(Equipo)
        .options(
            joinedload(Equipo.modelo),
            joinedload(Equipo.configuraciones).joinedload(EquipoConfiguracion.atributo),
            joinedload(Equipo.configuraciones).joinedload(EquipoConfiguracion.opcion),
        )
        .filter(Equipo.id == id_equipo)
        .first()
    )
    assert obj is not None
    return _equipo_response_payload(obj)


@router.post("/equipos/{id_equipo}/foto-principal", response_model=EquipoResponse)
def usar_foto_equipo_como_principal_tienda(
    id_equipo: int,
    db: Session = Depends(get_db),
):
    obj = db.query(Equipo).filter(Equipo.id == id_equipo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    if not obj.foto_url:
        raise HTTPException(status_code=400, detail="El equipo no tiene foto cargada.")
    if obj.producto is None:
        raise HTTPException(status_code=400, detail="El equipo no tiene producto asociado.")
    obj.producto.foto_principal_url = obj.foto_url
    db.commit()
    obj = (
        db.query(Equipo)
        .options(
            joinedload(Equipo.modelo),
            joinedload(Equipo.configuraciones).joinedload(EquipoConfiguracion.atributo),
            joinedload(Equipo.configuraciones).joinedload(EquipoConfiguracion.opcion),
        )
        .filter(Equipo.id == id_equipo)
        .first()
    )
    assert obj is not None
    return _equipo_response_payload(obj)


@router.get("/equipos-usados-detalle", response_model=list[EquipoUsadoDetalleResponse])
def listar_equipos_usados_detalle(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return db.query(EquipoUsadoDetalle).offset(skip).limit(limit).all()


@router.post(
    "/equipos-usados-detalle",
    response_model=EquipoUsadoDetalleResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_equipo_usado_detalle(payload: EquipoUsadoDetalleCreate, db: Session = Depends(get_db)):
    obj = EquipoUsadoDetalle(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/equipos-usados-detalle/{id_detalle_usado}", response_model=EquipoUsadoDetalleResponse)
def obtener_equipo_usado_detalle(id_detalle_usado: int, db: Session = Depends(get_db)):
    obj = (
        db.query(EquipoUsadoDetalle)
        .filter(EquipoUsadoDetalle.id_detalle_usado == id_detalle_usado)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Detalle de usado no encontrado")
    return obj


@router.patch("/equipos-usados-detalle/{id_detalle_usado}", response_model=EquipoUsadoDetalleResponse)
def actualizar_equipo_usado_detalle(
    id_detalle_usado: int,
    payload: EquipoUsadoDetalleUpdate,
    db: Session = Depends(get_db),
):
    obj = (
        db.query(EquipoUsadoDetalle)
        .filter(EquipoUsadoDetalle.id_detalle_usado == id_detalle_usado)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Detalle de usado no encontrado")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/equipos-usados-detalle/{id_detalle_usado}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_equipo_usado_detalle(id_detalle_usado: int, db: Session = Depends(get_db)):
    obj = (
        db.query(EquipoUsadoDetalle)
        .filter(EquipoUsadoDetalle.id_detalle_usado == id_detalle_usado)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Detalle de usado no encontrado")
    db.delete(obj)
    db.commit()
    return None


@router.get("/depositos", response_model=list[DepositoResponse])
def listar_depositos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return db.query(Deposito).offset(skip).limit(limit).all()


@router.post("/depositos", response_model=DepositoResponse, status_code=status.HTTP_201_CREATED)
def crear_deposito(payload: DepositoCreate, db: Session = Depends(get_db)):
    obj = Deposito(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/depositos/{id_deposito}", response_model=DepositoResponse)
def obtener_deposito(id_deposito: int, db: Session = Depends(get_db)):
    obj = db.query(Deposito).filter(Deposito.id_deposito == id_deposito).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Depósito no encontrado")
    return obj


@router.patch("/depositos/{id_deposito}", response_model=DepositoResponse)
def actualizar_deposito(id_deposito: int, payload: DepositoUpdate, db: Session = Depends(get_db)):
    obj = db.query(Deposito).filter(Deposito.id_deposito == id_deposito).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Depósito no encontrado")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/depositos/{id_deposito}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_deposito(id_deposito: int, db: Session = Depends(get_db)):
    obj = db.query(Deposito).filter(Deposito.id_deposito == id_deposito).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Depósito no encontrado")
    db.delete(obj)
    db.commit()
    return None


@router.get("/equipo-deposito", response_model=list[EquipoDepositoResponse])
def listar_equipo_deposito(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return db.query(EquipoDeposito).offset(skip).limit(limit).all()


@router.post(
    "/equipo-deposito",
    response_model=EquipoDepositoResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_equipo_deposito(payload: EquipoDepositoCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data.get("fecha_asignacion") is None:
        data["fecha_asignacion"] = datetime.now(timezone.utc)
    obj = EquipoDeposito(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/equipo-deposito/{id_equipo_deposito}", response_model=EquipoDepositoResponse)
def obtener_equipo_deposito(id_equipo_deposito: int, db: Session = Depends(get_db)):
    obj = (
        db.query(EquipoDeposito)
        .filter(EquipoDeposito.id_equipo_deposito == id_equipo_deposito)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Registro equipo-depósito no encontrado")
    return obj


@router.patch("/equipo-deposito/{id_equipo_deposito}", response_model=EquipoDepositoResponse)
def actualizar_equipo_deposito(
    id_equipo_deposito: int,
    payload: EquipoDepositoUpdate,
    db: Session = Depends(get_db),
):
    obj = (
        db.query(EquipoDeposito)
        .filter(EquipoDeposito.id_equipo_deposito == id_equipo_deposito)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Registro equipo-depósito no encontrado")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/equipo-deposito/{id_equipo_deposito}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_equipo_deposito(id_equipo_deposito: int, db: Session = Depends(get_db)):
    obj = (
        db.query(EquipoDeposito)
        .filter(EquipoDeposito.id_equipo_deposito == id_equipo_deposito)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Registro equipo-depósito no encontrado")
    db.delete(obj)
    db.commit()
    return None
