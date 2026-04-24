import re
from collections import defaultdict

from sqlalchemy.orm import Session, joinedload

from app.config import UPLOAD_DIR
from app.models.accesorios import Accesorios
from app.models.equipos import Equipos
from app.models.productos import Productos
from app.schemas.productos import ProductoBase, ProductoCreate, ProductoPatch


def _descripcion_catalogo(texto: str | None) -> str | None:
    t = (texto or "").strip()
    if not t:
        return None
    if t.lower() == "producto autogenerado desde inventario":
        return None
    return t


def titulo_tienda_sin_etiqueta_nuevo(nombre: str | None) -> str:
    """Quita rotulos de marketing 'nuevo' del titulo mostrado en tienda (el dato sigue en BD)."""
    s = (nombre or "").strip()
    if not s:
        return ""
    s = re.sub(r"(?i)\s*-\s*nuevo\s*$", "", s)
    s = re.sub(r"(?i)\s+nuevo\s*$", "", s)
    s = re.sub(r"(?i)^nuevo\s+[-·,]\s*", "", s)
    s = re.sub(r"(?i)\bnuevo\b", "", s)
    s = re.sub(r"\s{2,}", " ", s).strip(" -–·").strip()
    return s or (nombre or "").strip()


def _es_reparacion(nombre: str | None, descripcion: str | None) -> bool:
    name = (nombre or "").strip().lower()
    desc = (descripcion or "").strip().lower()
    return (
        name.startswith("reparación")
        or name.startswith("reparacion")
        or "reparación -" in name
        or "reparacion -" in name
        or "servicio de reparación" in desc
        or "servicio de reparacion" in desc
    )


def _es_linea_usado_por_estado_o_nombre(
    estado_comercial: str | None,
    tipo_equipo: str | None,
    nombre_producto: str | None,
) -> bool:
    estado = (estado_comercial or "").strip().lower()
    if estado == "usado":
        return True
    t = (tipo_equipo or "").strip().lower()
    n = (nombre_producto or "").strip().lower()
    if any(x in t for x in ("usad", "reacond", "semi")):
        return True
    if "usado" in n or "reacondicionado" in n or n.endswith("- usado"):
        return True
    return False


def _variante_tienda_dict(p: Productos, e: Equipos) -> dict:
    m = e.modelo
    color = (e.color or (m.color if m else None) or "").strip() or None
    return {
        "id_producto": p.id,
        "color": color,
        "precio": float(p.precio) if p.precio is not None else 0.0,
        "precio_usd": float(p.precio_usd) if getattr(p, "precio_usd", None) is not None else None,
        "foto_url": _foto_url_si_existe(e.foto_url),
        "nombre_corto": titulo_tienda_sin_etiqueta_nuevo(p.nombre),
        "stock": 1,
    }


def _coleccion_variantes_mismo_modelo_nuevos(db: Session, id_modelo: int) -> list[dict]:
    rows = (
        db.query(Productos, Equipos)
        .join(Equipos, Equipos.id_producto == Productos.id)
        .options(joinedload(Equipos.modelo))
        .filter(
            Equipos.id_modelo == id_modelo,
            Productos.activo.is_(True),
            Equipos.activo.is_(True),
        )
        .all()
    )
    # Agrupa por producto+color para evitar variantes duplicadas por unidad física.
    agg: dict[tuple[int, str], dict] = {}
    for sp, se in rows:
        if _es_reparacion(sp.nombre, sp.descripcion):
            continue
        if _es_linea_usado_por_estado_o_nombre(se.estado_comercial, se.tipo_equipo, sp.nombre):
            continue
        item = _variante_tienda_dict(sp, se)
        key = (int(item["id_producto"]), (item.get("color") or "").lower())
        prev = agg.get(key)
        if prev is None:
            agg[key] = item
        else:
            prev["stock"] = int(prev.get("stock", 1)) + 1
            # Mantener foto estable por variante: si no había, tomar la nueva.
            if not prev.get("foto_url") and item.get("foto_url"):
                prev["foto_url"] = item["foto_url"]
            # Precio mínimo como referencia por variante.
            try:
                prev["precio"] = min(float(prev.get("precio", 0.0)), float(item.get("precio", 0.0)))
            except Exception:
                pass
            if prev.get("precio_usd") is None and item.get("precio_usd") is not None:
                prev["precio_usd"] = item.get("precio_usd")
    out = list(agg.values())
    out.sort(key=lambda v: ((v.get("color") or ""), v["id_producto"]))
    return out


def _foto_url_si_existe(foto_url: str | None) -> str | None:
    if not foto_url:
        return None
    path = foto_url.strip()
    if not path.startswith("/uploads/"):
        return path
    rel = path[len("/uploads/") :]
    abs_path = UPLOAD_DIR / rel
    return path if abs_path.exists() else None


def _foto_principal_producto(p: Productos | None) -> str | None:
    if p is None:
        return None
    return _foto_url_si_existe(getattr(p, "foto_principal_url", None))


def _foto_canonica_modelo(db: Session, id_modelo: int) -> str | None:
    """
    Devuelve una foto estable para el modelo.
    Prioriza la primera unidad (id más bajo) que tenga foto válida, incluso si
    ya no está activa, para evitar "saltos" visuales al vender una unidad.
    """
    equipos_modelo = (
        db.query(Equipos.id, Equipos.foto_url)
        .filter(Equipos.id_modelo == id_modelo)
        .order_by(Equipos.id.asc())
        .all()
    )
    for _, foto_url in equipos_modelo:
        fu = _foto_url_si_existe(foto_url)
        if fu:
            return fu
    return None

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
            foto_url = _foto_principal_producto(p) or foto_por_producto_equipo.get(p.id)
        elif p.id in accesorios_por_producto:
            tipo_producto = "accesorio"
            id_origen = accesorios_por_producto[p.id]
            foto_url = foto_por_producto_accesorio.get(p.id)

        response.append(
            {
                "id": p.id,
                "nombre": p.nombre,
                "descripcion": _descripcion_catalogo(p.descripcion),
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
        "descripcion": _descripcion_catalogo(producto.descripcion),
        "precio": producto.precio,
        "precio_usd": getattr(producto, "precio_usd", None),
        "id_categoria": producto.id_categoria,
        "activo": producto.activo,
        "tipo_producto": None,
        "id_origen": None,
        "tipo_equipo": None,
        "detalle_equipo": None,
        "detalle_accesorio": None,
        "variantes_tienda": None,
    }

    equipo = (
        db.query(Equipos)
        .options(joinedload(Equipos.modelo))
        .filter(Equipos.id_producto == producto.id)
        .first()
    )
    if equipo:
        base["tipo_producto"] = "equipo"
        base["id_origen"] = equipo.id
        base["tipo_equipo"] = equipo.tipo_equipo
        base["foto_url"] = _foto_principal_producto(producto) or _foto_url_si_existe(equipo.foto_url)
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
        if not _es_reparacion(producto.nombre, producto.descripcion) and not _es_linea_usado_por_estado_o_nombre(
            equipo.estado_comercial, equipo.tipo_equipo, producto.nombre
        ):
            base["variantes_tienda"] = _coleccion_variantes_mismo_modelo_nuevos(db, int(equipo.id_modelo))
        else:
            base["variantes_tienda"] = []
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


def get_catalogo_tienda_agrupado(db: Session) -> list[dict]:
    """
    Una tarjeta por modelo (id_modelo) para equipos nuevos en tienda.
    Cada entrada incluye variantes (id_producto por unidad/color) y stock.
    """
    rows = (
        db.query(Productos, Equipos)
        .join(Equipos, Equipos.id_producto == Productos.id)
        .options(joinedload(Equipos.modelo))
        .filter(Productos.activo.is_(True), Equipos.activo.is_(True))
        .all()
    )
    by_model: dict[int, list[tuple[Productos, Equipos]]] = defaultdict(list)
    for p, e in rows:
        if _es_reparacion(p.nombre, p.descripcion):
            continue
        if _es_linea_usado_por_estado_o_nombre(e.estado_comercial, e.tipo_equipo, p.nombre):
            continue
        if not e.modelo:
            continue
        by_model[int(e.id_modelo)].append((p, e))

    catalogo: list[dict] = []
    for id_modelo, pairs in by_model.items():
        variantes: list[dict] = []
        agg_var: dict[tuple[int, str], dict] = {}
        for p, eq in pairs:
            item = _variante_tienda_dict(p, eq)
            key = (int(item["id_producto"]), (item.get("color") or "").lower())
            prev = agg_var.get(key)
            if prev is None:
                agg_var[key] = item
            else:
                prev["stock"] = int(prev.get("stock", 1)) + 1
                if not prev.get("foto_url") and item.get("foto_url"):
                    prev["foto_url"] = item["foto_url"]
                try:
                    prev["precio"] = min(float(prev.get("precio", 0.0)), float(item.get("precio", 0.0)))
                except Exception:
                    pass
                if prev.get("precio_usd") is None and item.get("precio_usd") is not None:
                    prev["precio_usd"] = item.get("precio_usd")
        variantes = list(agg_var.values())
        variantes.sort(key=lambda v: ((v.get("color") or ""), v["id_producto"]))

        min_row = min(pairs, key=lambda pe: float(pe[0].precio or 0))
        p0, e0 = min_row
        m0 = e0.modelo
        assert m0 is not None
        cap = m0.capacidad_gb
        titulo_base = titulo_tienda_sin_etiqueta_nuevo(m0.nombre_modelo)
        titulo = titulo_base
        if cap is not None:
            titulo = f"{titulo_base} {cap} GB".strip()

        foto_grupo = _foto_principal_producto(p0) or _foto_canonica_modelo(db, id_modelo)
        if foto_grupo is None:
            for _, eq in pairs:
                fu = _foto_url_si_existe(eq.foto_url)
                if fu:
                    foto_grupo = fu
                    break

        precios = [float(p.precio) for p, _ in pairs if p.precio is not None]
        precio_desde = min(precios) if precios else 0.0
        usd_vals = [
            float(p.precio_usd)
            for p, _ in pairs
            if getattr(p, "precio_usd", None) is not None and p.precio_usd is not None
        ]
        precio_usd_desde = min(usd_vals) if usd_vals else None

        rep_id = min(p.id for p, _ in pairs)

        catalogo.append(
            {
                "tipo_catalogo": "grupo_equipo",
                "id_modelo": id_modelo,
                "id": rep_id,
                "nombre": titulo,
                "descripcion": _descripcion_catalogo(p0.descripcion),
                "foto_url": foto_grupo,
                "precio": precio_desde,
                "precio_usd": precio_usd_desde,
                "id_categoria": p0.id_categoria,
                "activo": True,
                "tipo_producto": "equipo",
                "id_origen": e0.id,
                "tipo_equipo": e0.tipo_equipo,
                "estado_comercial": "nuevo",
                "stock": sum(int(v.get("stock", 1)) for v in variantes),
                "variantes_tienda": variantes,
            }
        )

    catalogo.sort(key=lambda x: (x["nombre"] or "").lower())
    return catalogo


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