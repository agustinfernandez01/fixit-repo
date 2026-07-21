import re
from collections import defaultdict
from functools import lru_cache

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.config import UPLOAD_DIR
from app.models.accesorios import Accesorios
from app.models.equipos import (
    Equipos,
    ModeloAtributo,
    ModeloAtributoOpcion,
    ModeloEquipo,
    EquipoConfiguracion,
    EquipoUsadoDetalle,
)
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


def _titulo_familia_sin_capacidad(nombre: str | None) -> str:
    s = titulo_tienda_sin_etiqueta_nuevo(nombre)
    if not s:
        return ""
    s = re.sub(r"(?i)\b\d{2,4}\s*gb\b", "", s)
    s = re.sub(r"\s{2,}", " ", s).strip(" -–·").strip()
    return s or titulo_tienda_sin_etiqueta_nuevo(nombre)


def _clave_familia_catalogo(p: Productos, e: Equipos) -> str:
    m = e.modelo
    fuente = (
        (m.nombre_modelo if m and m.nombre_modelo else None)
        or e.tipo_equipo
        or p.nombre
        or f"producto-{p.id}"
    )
    return _titulo_familia_sin_capacidad(fuente).lower() or f"producto-{p.id}"


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


def _foto_equipo_efectiva(e: Equipos) -> str | None:
    """Foto del equipo: usa foto_url propia; si no, busca la foto de la opción de color."""
    if e.foto_url:
        return _foto_url_si_existe(e.foto_url)
    for cfg in getattr(e, "configuraciones", []) or []:
        atributo = getattr(cfg, "atributo", None)
        if atributo and getattr(atributo, "code", "").strip().lower() == "color":
            opcion = getattr(cfg, "opcion", None)
            if opcion:
                return getattr(opcion, "foto_url", None)
    return None


def _variante_tienda_dict(p: Productos, e: Equipos) -> dict:
    m = e.modelo
    color = (e.color or (m.color if m else None) or "").strip() or None
    atributos = _extraer_atributos_variante(p, e)
    return {
        "id_producto": p.id,
        "color": color,
        "precio": float(p.precio) if p.precio is not None else 0.0,
        "precio_usd": float(p.precio_usd) if getattr(p, "precio_usd", None) is not None else None,
        "foto_url": _foto_equipo_efectiva(e),
        "nombre_corto": titulo_tienda_sin_etiqueta_nuevo(p.nombre),
        "stock": 1,
        "disponible": True,
        "atributos": atributos,
    }


def _coleccion_variantes_mismo_modelo_nuevos(db: Session, id_modelo: int) -> list[dict]:
    rows = (
        db.query(Productos, Equipos)
        .join(Equipos, Equipos.id_producto == Productos.id)
        .options(
            joinedload(Equipos.modelo),
            selectinload(Equipos.configuraciones).joinedload(EquipoConfiguracion.atributo),
            selectinload(Equipos.configuraciones).joinedload(EquipoConfiguracion.opcion),
        )
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
    cache_fotos = CacheFotosCanonicas(
        db, {int(item["id_producto"]) for item in out}, set()
    )
    for item in out:
        item["disponible"] = int(item.get("stock", 0)) > 0
        item["foto_url"] = item.get("foto_url") or cache_fotos.foto_variante(
            int(item["id_producto"]), item.get("color")
        )
    out.sort(key=lambda v: ((v.get("color") or ""), v["id_producto"]))
    return out


def _ids_modelo_de_familia(db: Session, familia_key: str) -> list[int]:
    """
    Modelos cuya clave de familia coincide, para poder filtrar en SQL.

    `_clave_familia_catalogo` normaliza con regex en Python, así que no se puede
    expresar como WHERE. Pero cuando el modelo tiene `nombre_modelo`, la clave
    depende *solo* de ese nombre: resolvemos la correspondencia sobre la tabla de
    modelos (chica) y filtramos la query grande por `id_modelo IN (...)`.

    Los modelos sin `nombre_modelo` se incluyen igual, porque ahí la clave se calcula
    desde `tipo_equipo`/`producto.nombre` y hay que filtrarlos en Python.
    """
    ids: list[int] = []
    for id_modelo, nombre_modelo in db.query(ModeloEquipo.id, ModeloEquipo.nombre_modelo).all():
        if not (nombre_modelo or "").strip():
            ids.append(int(id_modelo))  # fallback: se filtra en Python
        elif _titulo_familia_sin_capacidad(nombre_modelo).lower() == familia_key:
            ids.append(int(id_modelo))
    return ids


def _coleccion_variantes_misma_familia_nuevos(db: Session, familia_key: str) -> list[dict]:
    ids_modelo = _ids_modelo_de_familia(db, familia_key)
    if not ids_modelo:
        return []

    rows = (
        db.query(Productos, Equipos)
        .join(Equipos, Equipos.id_producto == Productos.id)
        .options(
            joinedload(Equipos.modelo),
            # selectinload sobre la colección: dos joinedload encadenados sobre la
            # misma one-to-many producen un producto cartesiano de filas.
            selectinload(Equipos.configuraciones).joinedload(EquipoConfiguracion.atributo),
            selectinload(Equipos.configuraciones).joinedload(EquipoConfiguracion.opcion),
        )
        .filter(
            Equipos.id_modelo.in_(ids_modelo),
            Productos.activo.is_(True),
            Equipos.activo.is_(True),
        )
        .all()
    )
    agg: dict[tuple[int, str], dict] = {}
    for sp, se in rows:
        if _es_reparacion(sp.nombre, sp.descripcion):
            continue
        if _es_linea_usado_por_estado_o_nombre(se.estado_comercial, se.tipo_equipo, sp.nombre):
            continue
        if _clave_familia_catalogo(sp, se) != familia_key:
            continue
        item = _variante_tienda_dict(sp, se)
        key = (int(item["id_producto"]), (item.get("color") or "").lower())
        prev = agg.get(key)
        if prev is None:
            agg[key] = item
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

    out = list(agg.values())
    # Una sola query para las fotos canónicas de todas las variantes, en vez de una por variante.
    cache_fotos = CacheFotosCanonicas(
        db, {int(item["id_producto"]) for item in out}, set()
    )
    for item in out:
        item["disponible"] = int(item.get("stock", 0)) > 0
        item["foto_url"] = item.get("foto_url") or cache_fotos.foto_variante(
            int(item["id_producto"]), item.get("color")
        )
    out.sort(
        key=lambda v: (
            (v.get("atributos", {}).get("almacenamiento") or ""),
            (v.get("color") or ""),
            v["id_producto"],
        )
    )
    return out


@lru_cache(maxsize=4096)
def _existe_en_uploads(rel: str) -> bool:
    """
    Cachea el `stat()` de disco de las imágenes legacy de /uploads.

    Sin caché, el catálogo hacía cientos de accesos a disco por request. Las fotos
    nuevas van a R2 (no pasan por acá) y los archivos legacy no se borran en caliente,
    así que cachear el resultado es seguro. `limpiar_cache_fotos_uploads()` lo purga
    si alguna vez hace falta.
    """
    return (UPLOAD_DIR / rel).exists()


def limpiar_cache_fotos_uploads() -> None:
    _existe_en_uploads.cache_clear()


def _foto_url_si_existe(foto_url: str | None) -> str | None:
    if not foto_url:
        return None
    path = foto_url.strip()
    if not path.startswith("/uploads/"):
        return path
    rel = path[len("/uploads/") :]
    return path if _existe_en_uploads(rel) else None


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


def _foto_canonica_variante_desde_filas(
    filas: list[tuple[str | None, str | None]], color: str | None
) -> str | None:
    """Resuelve la foto canónica de una variante sobre filas (foto_url, color) ya cargadas."""
    color_norm = (color or "").strip().lower()
    for foto_url, eq_color in filas:
        eq_color_norm = (eq_color or "").strip().lower()
        if color_norm and eq_color_norm and eq_color_norm != color_norm:
            continue
        fu = _foto_url_si_existe(foto_url)
        if fu:
            return fu
    for foto_url, _ in filas:
        fu = _foto_url_si_existe(foto_url)
        if fu:
            return fu
    return None


class CacheFotosCanonicas:
    """
    Precarga en UNA query las fotos de todos los equipos de los productos/modelos
    pedidos, para resolver `_foto_canonica_variante` y `_foto_canonica_modelo` en
    memoria.

    Antes, el catálogo hacía una query por variante y otra por familia: ~200 queries
    por request.
    """

    def __init__(self, db: Session, ids_producto: set[int], ids_modelo: set[int]):
        self._por_producto: dict[int, list[tuple[str | None, str | None]]] = defaultdict(list)
        self._por_modelo: dict[int, list[str | None]] = defaultdict(list)

        if not ids_producto and not ids_modelo:
            return

        condiciones = []
        if ids_producto:
            condiciones.append(Equipos.id_producto.in_(sorted(ids_producto)))
        if ids_modelo:
            condiciones.append(Equipos.id_modelo.in_(sorted(ids_modelo)))

        # Deliberadamente sin filtro de `activo`: la foto debe ser estable aunque se
        # venda o reserve una unidad.
        filas = (
            db.query(Equipos.id_producto, Equipos.id_modelo, Equipos.foto_url, Equipos.color)
            .filter(or_(*condiciones))
            .order_by(Equipos.id.asc())
            .all()
        )
        for id_producto, id_modelo, foto_url, color in filas:
            if id_producto is not None:
                self._por_producto[int(id_producto)].append((foto_url, color))
            if id_modelo is not None:
                self._por_modelo[int(id_modelo)].append(foto_url)

    def foto_variante(self, id_producto: int, color: str | None) -> str | None:
        return _foto_canonica_variante_desde_filas(
            self._por_producto.get(int(id_producto), []), color
        )

    def foto_modelo(self, id_modelo: int) -> str | None:
        for foto_url in self._por_modelo.get(int(id_modelo), []):
            fu = _foto_url_si_existe(foto_url)
            if fu:
                return fu
        return None


def _foto_canonica_variante(db: Session, id_producto: int, color: str | None) -> str | None:
    """
    Foto estable por variante (producto+color).
    No depende de `Equipos.activo` para evitar "saltos" al vender/reservar una unidad.
    """
    filas = (
        db.query(Equipos.foto_url, Equipos.color)
        .filter(Equipos.id_producto == id_producto)
        .order_by(Equipos.id.asc())
        .all()
    )
    return _foto_canonica_variante_desde_filas([(f, c) for f, c in filas], color)


def _valor_especificacion_por_regex(texto: str, patron: str) -> str | None:
    match = re.search(patron, texto, flags=re.IGNORECASE)
    if not match:
        return None
    value = (match.group(1) or "").strip()
    return value or None


def _normalizar_chip(raw: str | None) -> str | None:
    if not raw:
        return None
    s = raw.strip()
    if not s:
        return None
    return re.sub(r"\s{2,}", " ", s)


def _parse_capacidad_gb(texto: str | None) -> int | None:
    if not texto:
        return None
    m = re.search(r"\b(\d{2,4})\s*gb\b", texto, flags=re.IGNORECASE)
    if not m:
        return None
    try:
        capacidad = int(m.group(1))
    except Exception:
        return None
    return capacidad if capacidad > 0 else None


def _capacidad_gb_desde_configuracion(e: Equipos) -> int | None:
    for cfg in getattr(e, "configuraciones", []) or []:
        atributo = getattr(cfg, "atributo", None)
        opcion = getattr(cfg, "opcion", None)
        code = (getattr(atributo, "code", None) or "").strip().lower()
        if code not in {"almacenamiento", "storage", "gb", "capacidad"}:
            continue
        valor = (getattr(opcion, "label", None) or getattr(opcion, "valor", None) or "").strip()
        capacidad = _parse_capacidad_gb(valor)
        if capacidad is not None:
            return capacidad
    return None


def _extraer_atributos_variante(p: Productos, e: Equipos) -> dict[str, str]:
    if getattr(e, "configuraciones", None):
        attrs_cfg: dict[str, str] = {}
        for cfg in e.configuraciones:
            atributo = getattr(cfg, "atributo", None)
            opcion = getattr(cfg, "opcion", None)
            code = (getattr(atributo, "code", None) or "").strip()
            value = (getattr(opcion, "label", None) or getattr(opcion, "valor", None) or "").strip()
            if code and value:
                attrs_cfg[code] = value
        if attrs_cfg:
            return attrs_cfg

    m = e.modelo
    attrs: dict[str, str] = {}

    color = (e.color or (m.color if m else None) or "").strip()
    if color:
        attrs["color"] = color

    if m and m.capacidad_gb:
        attrs["almacenamiento"] = f"{m.capacidad_gb}GB"

    base_texto = " ".join(
        t
        for t in [
            p.nombre or "",
            p.descripcion or "",
            (m.nombre_modelo if m else "") or "",
            e.tipo_equipo or "",
        ]
        if t
    )

    ram = _valor_especificacion_por_regex(base_texto, r"\b(\d{1,2}\s?GB)\s*(?:RAM|de RAM)\b")
    if ram:
        attrs["ram"] = ram.replace(" ", "")

    chip = _valor_especificacion_por_regex(
        base_texto,
        r"\b(?:chip|procesador)\s*[:\-]?\s*([A-Za-z0-9\-\+ ]{2,30})",
    )
    if not chip:
        chip = _valor_especificacion_por_regex(base_texto, r"\b(M\d(?:\s?(?:Pro|Max|Ultra))?)\b")
    chip_norm = _normalizar_chip(chip)
    if chip_norm:
        attrs["chip"] = chip_norm

    return attrs


def _atributos_disponibles_desde_variantes(variantes: list[dict]) -> list[dict]:
    labels = {
        "color": "Color",
        "almacenamiento": "Almacenamiento",
        "ram": "Memoria RAM",
        "chip": "Chip / Procesador",
    }
    by_key: dict[str, set[str]] = defaultdict(set)
    for v in variantes:
        attrs = v.get("atributos") or {}
        if not isinstance(attrs, dict):
            continue
        for key, value in attrs.items():
            if not value:
                continue
            by_key[str(key)].add(str(value))

    out: list[dict] = []
    for code, opts in by_key.items():
        ordered = sorted(opts, key=lambda x: x.lower())
        out.append(
            {
                "code": code,
                "label": labels.get(code, code.capitalize()),
                "options": ordered,
            }
        )
    out.sort(key=lambda a: a["label"].lower())
    return out


def _atributos_modelo_definidos(db: Session, id_modelo: int) -> list[dict]:
    atributos = (
        db.query(ModeloAtributo)
        .options(joinedload(ModeloAtributo.opciones))
        .filter(ModeloAtributo.id_modelo == id_modelo, ModeloAtributo.activo.is_(True))
        .order_by(ModeloAtributo.orden.asc(), ModeloAtributo.id.asc())
        .all()
    )
    out: list[dict] = []
    for a in atributos:
        opciones = [
            (op.label or op.valor or "").strip()
            for op in sorted(a.opciones, key=lambda x: (int(x.orden or 0), int(x.id)))
            if bool(op.activo)
        ]
        opciones = [x for x in opciones if x]
        if not opciones:
            continue
        out.append(
            {
                "code": a.code,
                "label": a.label,
                "options": opciones,
            }
        )
    return out

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

        item: dict = {
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
        if tipo_producto == "accesorio":
            item["stock"] = int(p.stock or 0)
        response.append(item)

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
        "atributos_disponibles": None,
    }

    equipo = (
        db.query(Equipos)
        .options(
            joinedload(Equipos.modelo),
            selectinload(Equipos.configuraciones).joinedload(EquipoConfiguracion.atributo),
            selectinload(Equipos.configuraciones).joinedload(EquipoConfiguracion.opcion),
        )
        .filter(Equipos.id_producto == producto.id)
        .first()
    )
    if equipo:
        es_usado = _es_linea_usado_por_estado_o_nombre(
            equipo.estado_comercial, equipo.tipo_equipo, producto.nombre
        )
        capacidad_gb_detalle = equipo.modelo.capacidad_gb if equipo.modelo else None
        if es_usado and capacidad_gb_detalle is None:
            capacidad_gb_detalle = _capacidad_gb_desde_configuracion(equipo)
            if capacidad_gb_detalle is None:
                capacidad_gb_detalle = _parse_capacidad_gb(
                    " ".join(
                        t
                        for t in [
                            producto.nombre,
                            producto.descripcion,
                            equipo.modelo.nombre_modelo if equipo.modelo else None,
                            equipo.tipo_equipo,
                        ]
                        if t and str(t).strip()
                    )
                )
        base["tipo_producto"] = "equipo"
        base["id_origen"] = equipo.id
        base["tipo_equipo"] = equipo.tipo_equipo
        base["foto_url"] = _foto_principal_producto(producto) or _foto_url_si_existe(equipo.foto_url)
        detalle_usado = None
        if es_usado:
            detalle_usado = (
                db.query(EquipoUsadoDetalle)
                .filter(EquipoUsadoDetalle.id_equipo == equipo.id)
                .first()
            )
        base["detalle_equipo"] = {
            "id_equipo": equipo.id,
            "id_modelo": equipo.id_modelo,
            "nombre_modelo": equipo.modelo.nombre_modelo if equipo.modelo else None,
            "capacidad_gb": capacidad_gb_detalle,
            "color": getattr(equipo, "color", None),
            "tipo_equipo": equipo.tipo_equipo,
            "estado_comercial": equipo.estado_comercial,
            "foto_url": _foto_equipo_efectiva(equipo),
            "bateria_porcentaje": detalle_usado.bateria_porcentaje if detalle_usado else None,
            "estado_estetico": detalle_usado.estado_estetico if detalle_usado else None,
            "estado_funcional": detalle_usado.estado_funcional if detalle_usado else None,
            "detalle_pantalla": detalle_usado.detalle_pantalla if detalle_usado else None,
            "detalle_carcasa": detalle_usado.detalle_carcasa if detalle_usado else None,
            "incluye_caja": detalle_usado.incluye_caja if detalle_usado else None,
            "incluye_cargador": detalle_usado.incluye_cargador if detalle_usado else None,
        }
        if not _es_reparacion(producto.nombre, producto.descripcion) and not es_usado:
            familia_key = _clave_familia_catalogo(producto, equipo)
            base["variantes_tienda"] = _coleccion_variantes_misma_familia_nuevos(db, familia_key)
            base["atributos_disponibles"] = _atributos_modelo_definidos(db, int(equipo.id_modelo))
            if not base["atributos_disponibles"]:
                base["atributos_disponibles"] = _atributos_disponibles_desde_variantes(base["variantes_tienda"])
        else:
            base["variantes_tienda"] = []
            base["atributos_disponibles"] = []
        return base

    accesorio = db.query(Accesorios).filter(Accesorios.id_producto == producto.id).first()
    if accesorio:
        base["tipo_producto"] = "accesorio"
        base["id_origen"] = accesorio.id
        base["foto_url"] = _foto_principal_producto(producto) or _foto_url_si_existe(accesorio.foto_url)
        raw_stock = getattr(producto, "stock", None)
        is_active = bool(accesorio.estado) and bool(producto.activo)
        if raw_stock is not None and int(raw_stock) > 0:
            stock_val = int(raw_stock)
        else:
            stock_val = 1 if is_active else 0
        base["stock"] = stock_val
        base["variantes_tienda"] = [
            {
                "id_producto": producto.id,
                "color": accesorio.color or None,
                "precio": float(producto.precio) if producto.precio is not None else 0.0,
                "stock": stock_val,
                "disponible": stock_val > 0,
                "atributos": {},
                "foto_url": _foto_url_si_existe(accesorio.foto_url),
            }
        ]
        base["atributos_disponibles"] = []
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
        .options(
            joinedload(Equipos.modelo),
            # selectinload sobre la colección: dos joinedload encadenados sobre la
            # misma one-to-many producen un producto cartesiano de filas.
            selectinload(Equipos.configuraciones).joinedload(EquipoConfiguracion.atributo),
            selectinload(Equipos.configuraciones).joinedload(EquipoConfiguracion.opcion),
        )
        .filter(Productos.activo.is_(True), Equipos.activo.is_(True))
        .all()
    )
    by_family: dict[str, list[tuple[Productos, Equipos]]] = defaultdict(list)
    for p, e in rows:
        if _es_reparacion(p.nombre, p.descripcion):
            continue
        if _es_linea_usado_por_estado_o_nombre(e.estado_comercial, e.tipo_equipo, p.nombre):
            continue
        if not e.modelo:
            continue
        by_family[_clave_familia_catalogo(p, e)].append((p, e))

    # Precarga de fotos canónicas: una query para todo el catálogo en lugar de una
    # por variante (`_foto_canonica_variante`) y una por familia (`_foto_canonica_modelo`).
    cache_fotos = CacheFotosCanonicas(
        db,
        {int(p.id) for pares in by_family.values() for p, _ in pares},
        {int(e.id_modelo) for pares in by_family.values() for _, e in pares},
    )

    catalogo: list[dict] = []
    for family_key, pairs in by_family.items():
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
        for item in variantes:
            item["disponible"] = int(item.get("stock", 0)) > 0
            item["foto_url"] = cache_fotos.foto_variante(
                int(item["id_producto"]), item.get("color")
            ) or item.get("foto_url")
        variantes.sort(
            key=lambda v: (
                (v.get("atributos", {}).get("almacenamiento") or ""),
                (v.get("color") or ""),
                v["id_producto"],
            )
        )

        min_row = min(pairs, key=lambda pe: float(pe[0].precio or 0))
        p0, e0 = min_row
        m0 = e0.modelo
        assert m0 is not None
        titulo = _titulo_familia_sin_capacidad(m0.nombre_modelo)

        id_modelo_ref = min(int(eq.id_modelo) for _, eq in pairs)
        foto_grupo = _foto_principal_producto(p0) or cache_fotos.foto_modelo(id_modelo_ref)
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
                "id_modelo": id_modelo_ref,
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