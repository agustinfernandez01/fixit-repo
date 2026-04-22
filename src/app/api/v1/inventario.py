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
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.config import UPLOAD_DIR
from app.db import get_db
from app.models import (
    ModeloEquipo,
    Equipo,
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
    return db.query(ModeloEquipo).offset(skip).limit(limit).all()


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
    obj = db.query(ModeloEquipo).filter(ModeloEquipo.id == id_modelo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    return obj


@router.patch("/modelos/{id_modelo}", response_model=ModeloEquipoResponse)
def actualizar_modelo(id_modelo: int, payload: ModeloEquipoUpdate, db: Session = Depends(get_db)):
    obj = db.query(ModeloEquipo).filter(ModeloEquipo.id == id_modelo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")

    patch = payload.model_dump(exclude_unset=True)
    patch.pop("descripcion", None)
    for k, v in patch.items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/modelos/{id_modelo}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_modelo(id_modelo: int, db: Session = Depends(get_db)):
    obj = db.query(ModeloEquipo).filter(ModeloEquipo.id == id_modelo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
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
    rows = (
        db.query(Equipo)
        .options(joinedload(Equipo.modelo))
        .offset(skip)
        .limit(limit)
        .all()
    )
    for row in rows:
        row.foto_url = _foto_url_si_existe(row.foto_url)
    return rows


@router.post("/equipos", response_model=EquipoResponse, status_code=status.HTTP_201_CREATED)
def crear_equipo(payload: EquipoCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data.get("fecha_ingreso") is None:
        data["fecha_ingreso"] = datetime.now(timezone.utc)

    modelo = db.query(ModeloEquipo).filter(ModeloEquipo.id == data["id_modelo"]).first()
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")

    precio_ars = data.pop("precio_ars", None)
    precio_usd = data.pop("precio_usd", None)

    if data.get("id_producto") is not None:
        prod = db.query(Productos).filter(Productos.id == data["id_producto"]).first()
        if not prod:
            raise HTTPException(
                status_code=400,
                detail="El ID producto no existe en catálogo (productos).",
            )
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
                descripcion="Producto autogenerado desde inventario",
                precio=Decimal(str(precio_ars)) if precio_ars is not None else Decimal("0.00"),
                precio_usd=Decimal(str(precio_usd)) if precio_usd is not None else None,
                id_categoria=categoria.id,
                activo=True,
            )
            db.add(producto)
            db.flush()

        data["id_producto"] = producto.id

    obj = Equipo(**data)
    db.add(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo guardar el equipo. Revisá IMEI único e ID producto válido.",
        )
    db.refresh(obj)
    return obj


@router.get("/equipos/{id_equipo}", response_model=EquipoConModeloResponse)
def obtener_equipo(id_equipo: int, db: Session = Depends(get_db)):
    """Obtiene un equipo con su modelo en la misma consulta (join)."""
    obj = (
        db.query(Equipo)
        .options(joinedload(Equipo.modelo))
        .filter(Equipo.id == id_equipo)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    obj.foto_url = _foto_url_si_existe(obj.foto_url)
    return obj


@router.patch("/equipos/{id_equipo}", response_model=EquipoResponse)
def actualizar_equipo(id_equipo: int, payload: EquipoUpdate, db: Session = Depends(get_db)):
    obj = db.query(Equipo).filter(Equipo.id == id_equipo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    patch = payload.model_dump(exclude_unset=True)
    precio_ars = patch.pop("precio_ars", None)
    precio_usd = patch.pop("precio_usd", None)
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

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo actualizar el equipo. Revisá IMEI único e ID producto válido.",
        )
    db.refresh(obj)
    return obj


@router.delete("/equipos/{id_equipo}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_equipo(id_equipo: int, db: Session = Depends(get_db)):
    obj = db.query(Equipo).filter(Equipo.id == id_equipo).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    db.delete(obj)
    db.commit()
    return None


@router.post("/equipos/{id_equipo}/foto", response_model=EquipoResponse)
async def subir_foto_equipo(
    id_equipo: int,
    foto: UploadFile = File(...),
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
    db.commit()
    db.refresh(obj)
    return obj


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
