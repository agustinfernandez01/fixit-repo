from sqlalchemy.orm import Session
from app.models.productos import Productos
from app.models.accesorios import Accesorios
from app.models.equipos import Equipos
from app.schemas.productos import ProductoCreate, ProductoPatch, ProductoBase
from app.config import UPLOAD_DIR


def _foto_url_si_existe(foto_url: str | None) -> str | None:
    if not foto_url:
        return None
    path = foto_url.strip()
    if not path.startswith("/uploads/"):
        return path
    rel = path[len("/uploads/") :]
    abs_path = UPLOAD_DIR / rel
    return path if abs_path.exists() else None

#get - listar productos
def get_productos(db: Session) -> list[dict]:
    productos = db.query(Productos).all()

    equipos_rows = (
        db.query(
            Equipos.id,
            Equipos.id_producto,
            Equipos.tipo_equipo,
            Equipos.estado_comercial,
            Equipos.foto_url,
        )
        .filter(Equipos.id_producto.is_not(None))
        .all()
    )
    equipos_por_producto = {}
    tipo_equipo_por_producto = {}
    estado_comercial_por_producto = {}
    foto_por_producto_equipo = {}
    for id_equipo, id_producto, tipo_equipo, estado_comercial, foto_url in equipos_rows:
        if id_producto is None:
            continue
        if id_producto not in equipos_por_producto:
            equipos_por_producto[id_producto] = id_equipo
        if id_producto not in tipo_equipo_por_producto and tipo_equipo:
            tipo_equipo_por_producto[id_producto] = tipo_equipo
        if id_producto not in foto_por_producto_equipo and foto_url:
            foto_por_producto_equipo[id_producto] = _foto_url_si_existe(foto_url)

        estado_norm = (estado_comercial or "").strip().lower()
        previo = estado_comercial_por_producto.get(id_producto)
        # Si hay cualquier equipo usado ligado al producto, prevalece "usado"
        # para evitar que se cuele en la tienda de nuevos.
        if estado_norm == "usado" or previo is None:
            estado_comercial_por_producto[id_producto] = estado_norm or previo

    accesorios_rows = db.query(Accesorios.id, Accesorios.id_producto, Accesorios.foto_url).all()
    accesorios_por_producto = {}
    foto_por_producto_accesorio = {}
    for id_accesorio, id_producto, foto_url in accesorios_rows:
        if id_producto not in accesorios_por_producto:
            accesorios_por_producto[id_producto] = id_accesorio
        if id_producto not in foto_por_producto_accesorio:
            foto_por_producto_accesorio[id_producto] = _foto_url_si_existe(foto_url)

    response: list[dict] = []
    for p in productos:
        tipo_producto = None
        id_origen = None
        foto_url = None

        if p.id in equipos_por_producto:
            tipo_producto = "equipo"
            id_origen = equipos_por_producto[p.id]
            foto_url = foto_por_producto_equipo.get(p.id)
        elif p.id in accesorios_por_producto:
            tipo_producto = "accesorio"
            id_origen = accesorios_por_producto[p.id]
            foto_url = foto_por_producto_accesorio.get(p.id)

        response.append(
            {
                "id": p.id,
                "nombre": p.nombre,
                "descripcion": p.descripcion,
                "foto_url": foto_url,
                "precio": p.precio,
                "precio_usd": getattr(p, "precio_usd", None),
                "id_categoria": p.id_categoria,
                "activo": p.activo,
                "tipo_producto": tipo_producto,
                "id_origen": id_origen,
                "tipo_equipo": tipo_equipo_por_producto.get(p.id),
                "estado_comercial": estado_comercial_por_producto.get(p.id),
            }
        )

    return response


def get_producto_detalle(db: Session, id_producto: int) -> dict | None:
    producto = db.query(Productos).filter(Productos.id == id_producto).first()
    if not producto:
        return None

    base = {
        "id": producto.id,
        "nombre": producto.nombre,
        "descripcion": producto.descripcion,
        "precio": producto.precio,
        "precio_usd": getattr(producto, "precio_usd", None),
        "id_categoria": producto.id_categoria,
        "activo": producto.activo,
        "tipo_producto": None,
        "id_origen": None,
        "tipo_equipo": None,
        "detalle_equipo": None,
        "detalle_accesorio": None,
    }

    equipo = db.query(Equipos).filter(Equipos.id_producto == producto.id).first()
    if equipo:
        base["tipo_producto"] = "equipo"
        base["id_origen"] = equipo.id
        base["tipo_equipo"] = equipo.tipo_equipo
        base["detalle_equipo"] = {
            "id_equipo": equipo.id,
            "id_modelo": equipo.id_modelo,
            "nombre_modelo": equipo.modelo.nombre_modelo if equipo.modelo else None,
            "capacidad_gb": equipo.modelo.capacidad_gb if equipo.modelo else None,
            "color": getattr(equipo, "color", None),
            "tipo_equipo": equipo.tipo_equipo,
            "estado_comercial": equipo.estado_comercial,
            "foto_url": _foto_url_si_existe(equipo.foto_url),
        }
        return base

    accesorio = db.query(Accesorios).filter(Accesorios.id_producto == producto.id).first()
    if accesorio:
        base["tipo_producto"] = "accesorio"
        base["id_origen"] = accesorio.id
        base["detalle_accesorio"] = {
            "id_accesorio": accesorio.id,
            "tipo": accesorio.tipo,
            "nombre": accesorio.nombre,
            "color": accesorio.color,
            "descripcion": accesorio.descripcion,
            "estado": accesorio.estado,
        }

    return base

def create_producto(db: Session, producto: Productos) -> Productos:
    db.add(producto)
    db.flush()
    db.refresh(producto)
    return producto

# Verficiar cuantos equipos estan activos, si no hay activos se inhabilita
def desactivar_productos_si_no_hay_equipos_activos(db: Session, id_modelo: int) -> bool:
    equipo_activo = (
        db.query(Equipos)
        .filter(
            Equipos.id_modelo == id_modelo,
            Equipos.activo.is_(True)
        )
        .first()
    )

    if equipo_activo:
        return False

    productos_asociados = (
        db.query(Productos)
        .join(Equipos, Equipos.id_producto == Productos.id)
        .filter(
            Equipos.id_modelo == id_modelo,
            Productos.activo.is_(True)
        )
        .distinct()
        .all()
    )

    if not productos_asociados:
        return False

    for producto in productos_asociados:
        producto.activo = False

    return True
# Verificar si hay equipos activos, si hay se activa el producto
def activar_productos_si_hay_equipos_activos(db: Session, id_modelo: int) -> bool:
    equipo_activo = (
        db.query(Equipos)
        .filter(
            Equipos.id_modelo == id_modelo,
            Equipos.activo.is_(True)
        )
        .first()
    )

    if not equipo_activo:
        return False

    productos_asociados = (
        db.query(Productos)
        .join(Equipos, Equipos.id_producto == Productos.id)
        .filter(Equipos.id_modelo == id_modelo)
        .distinct()
        .all()
    )

    if not productos_asociados:
        return False

    for producto in productos_asociados:
        producto.activo = True

    return True