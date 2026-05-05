from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from urllib.parse import quote

from sqlalchemy import String, cast, func
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session, joinedload

from app.config import WHATSAPP_CHECKOUT_PHONE
from app.models.accesorios import Accesorios
from app.models.carrito import Carrito, CarritoDetalle
from app.models.equipos import Equipo
from app.models.pedido import DetallePedido, Pago, Pedido
from app.models.productos import Productos
from app.models.roles import Rol
from app.models.usuarios import Usuario
from app.schemas.carrito import CarritoDetalleBase, CarritoResumen


AVAILABILITY_CHECK_STATES = {
    "proximamente",
    "próximamente",
    "por_ingresar",
    "por ingresar",
    "en_transito",
    "en transito",
    "en tránsito",
    "reservado",
}

BLOCKED_STATES = {"vendido", "cancelado", "baja", "reservado_venta"}

# Tras confirmar el pedido desde admin: unidad bloqueada pero venta no cerrada hasta finalizar entrega.
RESERVADO_VENTA = "reservado_venta"

_GUEST_USER_EMAIL = "invitado.checkout@fixit.local"


def _get_or_create_guest_user_id(db: Session) -> int:
    """
    Checkout sin login requiere un `id_usuario` por restricción NOT NULL en `pedidos.id_usuario`.
    Creamos (o reutilizamos) un usuario interno "invitado" para asociar el pedido.
    """
    existing = db.query(Usuario).filter(Usuario.email == _GUEST_USER_EMAIL).first()
    if existing:
        return int(existing.id)

    roles = db.query(Rol).all()
    rol_cliente = next(
        (r for r in roles if (r.nombre or "").strip().lower().find("cliente") >= 0),
        None,
    )
    rol_id = int((rol_cliente or (roles[0] if roles else None)).id) if roles else None

    u = Usuario(
        nombre="Invitado",
        apellido="Checkout",
        email=_GUEST_USER_EMAIL,
        telefono="",
        password_hash="",
        id_rol=rol_id,
    )
    db.add(u)
    db.flush()  # asegura `u.id` dentro de la transacción
    return int(u.id)


def _carrito_activo_query(db: Session, token: str):
    estado_normalizado = func.lower(cast(Carrito.estado, String))
    return db.query(Carrito).filter(
        Carrito.token_identificador == token,
        estado_normalizado.in_(["true", "1", "t", "si", "sí", "activo"]),
    )


def get_carrito_by_token(db: Session, token: str) -> Optional[Carrito]:
    return _carrito_activo_query(db, token).first()


def get_or_create_carrito(
    db: Session, token: str, id_usuario: Optional[int] = None
) -> Tuple[Carrito, bool]:
    """
    Devuelve (carrito, created). Crea un carrito activo si no existe uno para el token.
    """
    existing = get_carrito_by_token(db, token)
    if existing:
        if id_usuario is not None and existing.id_usuario is None:
            existing.id_usuario = id_usuario
            db.commit()
            db.refresh(existing)
        return existing, False

    carrito = Carrito(
        token_identificador=token,
        id_usuario=id_usuario,
        estado=True,
    )
    db.add(carrito)
    db.commit()
    db.refresh(carrito)
    return carrito, True


def get_carrito_items(db: Session, id_carrito: int) -> List[CarritoDetalle]:
    items = (
        db.query(CarritoDetalle)
        .options(joinedload(CarritoDetalle.producto))
        .filter(CarritoDetalle.id_carrito == id_carrito)
        .all()
    )

    if not items:
        return items

    product_ids = [d.id_producto for d in items]

    equipos_rows = (
        db.query(Equipo.id, Equipo.id_producto, Equipo.foto_url)
        .filter(Equipo.id_producto.in_(product_ids))
        .all()
    )
    equipo_por_producto = {
        id_producto: {"id_equipo": id_equipo, "foto_url": foto_url}
        for id_equipo, id_producto, foto_url in equipos_rows
    }

    try:
        accesorios_rows = (
            db.query(Accesorios.id, Accesorios.id_producto, Accesorios.foto_url)
            .filter(Accesorios.id_producto.in_(product_ids))
            .all()
        )
    except OperationalError as exc:
        # Backward compatibility while DB migrations are being applied.
        if "Unknown column" in str(exc):
            db.rollback()
            accesorios_rows = (
                db.query(Accesorios.id, Accesorios.id_producto)
                .filter(Accesorios.id_producto.in_(product_ids))
                .all()
            )
            accesorios_rows = [
                (id_accesorio, id_producto, None)
                for id_accesorio, id_producto in accesorios_rows
            ]
        else:
            raise
    accesorio_por_producto = {}
    for id_accesorio, id_producto, foto_url in accesorios_rows:
        if id_producto not in accesorio_por_producto:
            accesorio_por_producto[id_producto] = {
                "id_accesorio": id_accesorio,
                "foto_url": foto_url,
            }

    for detalle in items:
        if not detalle.producto:
            continue
        detalle.producto.tipo_producto = None
        detalle.producto.id_origen = None
        detalle.producto.foto_url = None
        if detalle.id_producto in equipo_por_producto:
            detalle.producto.tipo_producto = "equipo"
            detalle.producto.id_origen = equipo_por_producto[detalle.id_producto]["id_equipo"]
            detalle.producto.foto_url = equipo_por_producto[detalle.id_producto]["foto_url"]
        elif detalle.id_producto in accesorio_por_producto:
            detalle.producto.tipo_producto = "accesorio"
            detalle.producto.id_origen = accesorio_por_producto[detalle.id_producto]["id_accesorio"]
            detalle.producto.foto_url = accesorio_por_producto[detalle.id_producto]["foto_url"]

    return items


def _require_carrito_por_token(db: Session, token: str) -> Carrito:
    carrito = get_carrito_by_token(db, token)
    if not carrito:
        raise ValueError("Carrito no encontrado")
    return carrito


def _detalle_pertenece_a_carrito(
    carrito: Carrito, detalle_id: int, db: Session
) -> CarritoDetalle:
    linea = (
        db.query(CarritoDetalle)
        .filter(
            CarritoDetalle.id == detalle_id,
            CarritoDetalle.id_carrito == carrito.id,
        )
        .first()
    )
    if not linea:
        raise ValueError("Línea de carrito no encontrada")
    return linea


def _equipo_es_vendible(equipo: Equipo) -> bool:
    estado_normalizado = (equipo.estado_comercial or "").strip().lower()
    if estado_normalizado in BLOCKED_STATES:
        return False
    if not bool(equipo.activo):
        return False
    return True


def list_equipos_vendibles_por_producto(db: Session, id_producto: int) -> List[Equipo]:
    equipos_producto = (
        db.query(Equipo)
        .filter(Equipo.id_producto == id_producto)
        .order_by(Equipo.id.asc())
        .all()
    )
    return [eq for eq in equipos_producto if _equipo_es_vendible(eq)]


def _hay_equipo_para_producto(db: Session, id_producto: int) -> bool:
    return (
        db.query(Equipo.id)
        .filter(Equipo.id_producto == id_producto)
        .first()
        is not None
    )


def _hay_accesorio_para_producto(db: Session, id_producto: int) -> bool:
    return (
        db.query(Accesorios.id)
        .filter(Accesorios.id_producto == id_producto)
        .first()
        is not None
    )


def stock_accesorio_producto(db: Session, id_producto: int) -> int:
    """Unidades disponibles de accesorio: `productos.stock` con accesorio de catálogo activo."""
    acc = (
        db.query(Accesorios)
        .filter(Accesorios.id_producto == id_producto)
        .first()
    )
    if not acc or not acc.estado:
        return 0
    p = db.query(Productos).filter(Productos.id == id_producto).first()
    if not p:
        return 0
    return max(0, int(p.stock or 0))


def unidades_vendibles_por_producto(db: Session, id_producto: int) -> int:
    """
    Stock vendible según el tipo de vínculo del producto (no se combinan fuentes):

    - Si hay fila en `accesorios` para este `id_producto` → `productos.stock` (accesorio activo).
    - Si no hay accesorios pero sí `equipo` → equipos elegibles.
    - Si no hay ninguna de las dos → 0.
    """
    if _hay_accesorio_para_producto(db, id_producto):
        return stock_accesorio_producto(db, id_producto)
    if _hay_equipo_para_producto(db, id_producto):
        return len(list_equipos_vendibles_por_producto(db, id_producto))
    return 0


def _validar_cantidad_contra_stock_vendible(
    db: Session, id_producto: int, cantidad: int
) -> None:
    if cantidad < 1:
        return
    if not _hay_equipo_para_producto(db, id_producto) and not _hay_accesorio_para_producto(
        db, id_producto
    ):
        raise ValueError(
            f"El producto {id_producto} no tiene unidades físicas asociadas para vender en línea."
        )
    n = unidades_vendibles_por_producto(db, id_producto)
    if cantidad > n:
        raise ValueError(
            f"Stock insuficiente: pedís {cantidad} unidad(es) y hay {n} disponible(s)."
        )


def add_item_to_carrito(
    db: Session, token: str, id_producto: int, cant: int = 1
) -> CarritoDetalle:
    try:
        if cant < 1:
            raise ValueError("La cantidad debe ser al menos 1")

        carrito, _ = get_or_create_carrito(db, token)

        producto = (
            db.query(Productos)
            .filter(Productos.id == id_producto, Productos.activo.is_(True))
            .first()
        )
        if not producto:
            raise ValueError("Producto no encontrado o inactivo")

        precio = Decimal(str(producto.precio))
        linea_existente = (
            db.query(CarritoDetalle)
            .filter(
                CarritoDetalle.id_carrito == carrito.id,
                CarritoDetalle.id_producto == id_producto,
            )
            .first()
        )

        if linea_existente:
            precio_unit = Decimal(str(linea_existente.precio_unitario))
            nueva_cant = linea_existente.cant + cant
            _validar_cantidad_contra_stock_vendible(db, id_producto, nueva_cant)
            linea_existente.cant = nueva_cant
            linea_existente.subtotal = precio_unit * nueva_cant
            db.commit()
            db.refresh(linea_existente)
            return linea_existente

        _validar_cantidad_contra_stock_vendible(db, id_producto, cant)
        subtotal = precio * cant
        linea = CarritoDetalle(
            id_carrito=carrito.id,
            id_producto=id_producto,
            cant=cant,
            precio_unitario=precio,
            subtotal=subtotal,
        )
        db.add(linea)
        db.commit()
        db.refresh(linea)
        return linea

    except IntegrityError:
        db.rollback()
        raise ValueError("Error de integridad al agregar al carrito")
    except ValueError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise ValueError("Ocurrió un error al agregar al carrito")


def update_line_quantity(
    db: Session, token: str, detalle_id: int, cant: int
) -> CarritoDetalle:
    try:
        if cant < 1:
            raise ValueError("La cantidad debe ser al menos 1")

        carrito = _require_carrito_por_token(db, token)
        linea = _detalle_pertenece_a_carrito(carrito, detalle_id, db)

        _validar_cantidad_contra_stock_vendible(db, linea.id_producto, cant)

        precio = Decimal(str(linea.precio_unitario))
        linea.cant = cant
        linea.subtotal = precio * cant

        db.commit()
        db.refresh(linea)
        return linea

    except IntegrityError:
        db.rollback()
        raise ValueError("Error al actualizar la línea")
    except ValueError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise ValueError("Ocurrió un error al actualizar la línea")


def remove_line(db: Session, token: str, detalle_id: int) -> None:
    try:
        carrito = _require_carrito_por_token(db, token)
        linea = _detalle_pertenece_a_carrito(carrito, detalle_id, db)
        db.delete(linea)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("Error al eliminar la línea")
    except ValueError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise ValueError("Ocurrió un error al eliminar la línea")


def clear_carrito(db: Session, token: str) -> None:
    try:
        carrito = _require_carrito_por_token(db, token)
        db.query(CarritoDetalle).filter(
            CarritoDetalle.id_carrito == carrito.id
        ).delete(synchronize_session=False)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("Error al vaciar el carrito")
    except ValueError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise ValueError("Ocurrió un error al vaciar el carrito")


def _carrito_detalle_con_stock(db: Session, d: CarritoDetalle) -> CarritoDetalleBase:
    parsed = CarritoDetalleBase.model_validate(d)
    stock = unidades_vendibles_por_producto(db, d.id_producto)
    return parsed.model_copy(update={"stock_disponible": stock})


def map_carrito_detalles_con_stock(
    db: Session, items: List[CarritoDetalle]
) -> List[CarritoDetalleBase]:
    return [_carrito_detalle_con_stock(db, d) for d in items]


def carrito_resumen(db: Session, token: str) -> CarritoResumen:
    carrito = get_carrito_by_token(db, token)
    if not carrito:
        raise ValueError("Carrito no encontrado")

    items = get_carrito_items(db, carrito.id)
    items_out = map_carrito_detalles_con_stock(db, items)
    total_unidades = sum(d.cant for d in items) if items else 0
    total_importe = sum(
        (Decimal(str(d.subtotal)) for d in items),
        start=Decimal("0"),
    )

    return CarritoResumen(
        carrito=carrito,
        items=items_out,
        total_unidades=total_unidades,
        total_importe=total_importe,
    )


def assign_user_to_carrito(db: Session, token: str, id_usuario: int) -> Carrito:
    """Asocia un carrito invitado al usuario (p. ej. tras login)."""
    try:
        carrito = _require_carrito_por_token(db, token)
        carrito.id_usuario = id_usuario
        db.commit()
        db.refresh(carrito)
        return carrito
    except IntegrityError:
        db.rollback()
        raise ValueError("Error al asociar el carrito al usuario")
    except ValueError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise ValueError("Ocurrió un error al asociar el carrito")


def merge_guest_cart_into_user_cart(
    db: Session, guest_token: str, id_usuario: int
) -> Carrito:
    """
    Une el carrito del token (invitado) con el carrito activo del usuario si existe;
    si no, asigna el usuario al carrito invitado.
    """
    try:
        guest = get_carrito_by_token(db, guest_token)
        user_cart = (
            db.query(Carrito)
            .filter(
                Carrito.id_usuario == id_usuario,
                func.lower(cast(Carrito.estado, String)).in_(
                    ["true", "1", "t", "si", "sí", "activo"]
                ),
                Carrito.id_pedido.is_(None),
            )
            .first()
        )

        # Caso típico al volver de checkout/WhatsApp: el token invitado ya no tiene
        # carrito activo (se cerró al generar pedido). En ese caso devolvemos el
        # carrito activo del usuario o creamos uno nuevo.
        if not guest:
            if user_cart:
                return user_cart

            nuevo = Carrito(
                token_identificador=guest_token,
                id_usuario=id_usuario,
                estado=True,
            )
            db.add(nuevo)
            db.commit()
            db.refresh(nuevo)
            return nuevo

        if guest.id_usuario is not None and guest.id_usuario != id_usuario:
            raise ValueError("El carrito ya pertenece a otro usuario")

        if not user_cart:
            guest.id_usuario = id_usuario
            db.commit()
            db.refresh(guest)
            return guest

        if user_cart.id == guest.id:
            return guest

        for linea in list(guest.carrito_detalle):
            existente = (
                db.query(CarritoDetalle)
                .filter(
                    CarritoDetalle.id_carrito == user_cart.id,
                    CarritoDetalle.id_producto == linea.id_producto,
                )
                .first()
            )
            if existente:
                nueva_cant = existente.cant + linea.cant
                _validar_cantidad_contra_stock_vendible(db, linea.id_producto, nueva_cant)
                existente.cant = nueva_cant
                pu = Decimal(str(existente.precio_unitario))
                existente.subtotal = pu * nueva_cant
                db.delete(linea)
            else:
                _validar_cantidad_contra_stock_vendible(db, linea.id_producto, linea.cant)
                linea.id_carrito = user_cart.id

        db.delete(guest)
        db.commit()
        db.refresh(user_cart)
        return user_cart

    except IntegrityError:
        db.rollback()
        raise ValueError("Error al fusionar carritos")
    except ValueError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise ValueError("Ocurrió un error al fusionar carritos")


def count_items_in_carrito(db: Session, id_carrito: int) -> int:
    result = (
        db.query(func.coalesce(func.sum(CarritoDetalle.cant), 0))
        .filter(CarritoDetalle.id_carrito == id_carrito)
        .scalar()
    )
    return int(result or 0)


def list_pedidos_pendientes_admin(db: Session, skip: int = 0, limit: int = 50) -> list[dict]:
    """Pedidos pendientes con ítems, cliente e IMEI de la unidad vinculada al producto (si existe)."""
    pedidos = (
        db.query(Pedido)
        .filter(Pedido.estado == "pendiente_confirmacion")
        .order_by(Pedido.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    resultado: list[dict] = []
    for p in pedidos:
        usuario = db.query(Usuario).filter(Usuario.id == p.id_usuario).first()
        detalles = (
            db.query(DetallePedido)
            .filter(DetallePedido.id_pedido == p.id)
            .options(joinedload(DetallePedido.producto))
            .all()
        )
        items: list[dict] = []
        for d in detalles:
            prod = d.producto
            nombre = prod.nombre if prod is not None else f"Producto {d.id_producto}"
            eq = db.query(Equipo).filter(Equipo.id_producto == d.id_producto).first()
            es_accesorio = _hay_accesorio_para_producto(db, d.id_producto)
            sub = d.subtotal if d.subtotal is not None else Decimal(str(d.precio_unitario)) * d.cantidad
            items.append(
                {
                    "id_detalle_pedido": int(d.id),
                    "id_producto": d.id_producto,
                    "producto_nombre": nombre,
                    "cantidad": d.cantidad,
                    "precio_unitario": str(d.precio_unitario),
                    "subtotal": str(sub),
                    "tipo_producto": "accesorio" if es_accesorio else "equipo",
                    "id_equipo": int(eq.id) if eq else None,
                    "imei": eq.imei if eq and eq.imei else None,
                    "estado_equipo": eq.estado_comercial if eq else None,
                }
            )
        total_unidades = sum(int(i["cantidad"]) for i in items)
        resultado.append(
            {
                "id_pedido": p.id,
                "id_usuario": p.id_usuario,
                "fecha_pedido": p.fecha_pedido,
                "estado": p.estado,
                "total": str(p.total) if p.total else "0",
                "observaciones": p.observaciones,
                "cliente": (
                    {
                        "id": usuario.id,
                        "nombre": (
                            " ".join(
                                p
                                for p in [
                                    (usuario.nombre or "").strip(),
                                    (usuario.apellido or "").strip(),
                                ]
                                if p
                            )
                            or None
                        ),
                        "email": usuario.email,
                        "telefono": usuario.telefono,
                    }
                    if usuario
                    else None
                ),
                "items": items,
                "resumen": {"total_items": len(items), "total_unidades": total_unidades},
            }
        )
    return resultado


def list_pedidos_confirmados_pendientes_entrega_admin(
    db: Session, skip: int = 0, limit: int = 50
) -> list[dict]:
    """Pedidos ya confirmados (pago aprobado) con unidades aún en reserva hasta cerrar entrega."""
    id_list = [
        row[0]
        for row in (
            db.query(DetallePedido.id_pedido)
            .join(Equipo, Equipo.id_producto == DetallePedido.id_producto)
            .filter(
                func.lower(func.trim(func.coalesce(Equipo.estado_comercial, ""))) == RESERVADO_VENTA
            )
            .distinct()
            .all()
        )
    ]
    if not id_list:
        return []

    filtrados = (
        db.query(Pedido)
        .filter(Pedido.estado == "confirmado", Pedido.id.in_(id_list))
        .order_by(Pedido.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    resultado: list[dict] = []
    for p in filtrados:
        usuario = db.query(Usuario).filter(Usuario.id == p.id_usuario).first()
        detalles = (
            db.query(DetallePedido)
            .filter(DetallePedido.id_pedido == p.id)
            .options(joinedload(DetallePedido.producto))
            .all()
        )
        items: list[dict] = []
        for d in detalles:
            prod = d.producto
            nombre = prod.nombre if prod is not None else f"Producto {d.id_producto}"
            eq = db.query(Equipo).filter(Equipo.id_producto == d.id_producto).first()
            es_accesorio = _hay_accesorio_para_producto(db, d.id_producto)
            sub = d.subtotal if d.subtotal is not None else Decimal(str(d.precio_unitario)) * d.cantidad
            items.append(
                {
                    "id_detalle_pedido": int(d.id),
                    "id_producto": d.id_producto,
                    "producto_nombre": nombre,
                    "cantidad": d.cantidad,
                    "precio_unitario": str(d.precio_unitario),
                    "subtotal": str(sub),
                    "tipo_producto": "accesorio" if es_accesorio else "equipo",
                    "id_equipo": int(eq.id) if eq else None,
                    "imei": eq.imei if eq and eq.imei else None,
                    "estado_equipo": eq.estado_comercial if eq else None,
                }
            )
        total_unidades = sum(int(i["cantidad"]) for i in items)
        resultado.append(
            {
                "id_pedido": p.id,
                "id_usuario": p.id_usuario,
                "fecha_pedido": p.fecha_pedido,
                "estado": p.estado,
                "total": str(p.total) if p.total else "0",
                "observaciones": p.observaciones,
                "cliente": (
                    {
                        "id": usuario.id,
                        "nombre": (
                            " ".join(
                                pr
                                for pr in [
                                    (usuario.nombre or "").strip(),
                                    (usuario.apellido or "").strip(),
                                ]
                                if pr
                            )
                            or None
                        ),
                        "email": usuario.email,
                        "telefono": usuario.telefono,
                    }
                    if usuario
                    else None
                ),
                "items": items,
                "resumen": {"total_items": len(items), "total_unidades": total_unidades},
            }
        )
    return resultado


def checkout_carrito(
    db: Session,
    token: str,
    id_usuario: Optional[int],
    metodo_pago: str,
    observaciones: Optional[str] = None,
) -> tuple[Pedido, Pago, str]:
    """
    Confirma la compra del carrito activo en una sola transacción:
    - valida disponibilidad de productos,
    - crea pedido y detalle,
    - registra pago pendiente (la reserva de stock ocurre al confirmar el pedido desde admin).
    """
    try:
        carrito = _require_carrito_por_token(db, token)
        items = get_carrito_items(db, carrito.id)

        if not items:
            raise ValueError("El carrito está vacío")
        if carrito.id_pedido is not None:
            raise ValueError("El carrito ya fue procesado")

        effective_user_id = id_usuario if id_usuario is not None else _get_or_create_guest_user_id(db)

        total = Decimal("0")

        for linea in items:
            producto = (
                db.query(Productos)
                .filter(
                    Productos.id == linea.id_producto,
                    Productos.activo.is_(True),
                )
                .first()
            )
            if not producto:
                raise ValueError(f"Producto {linea.id_producto} no disponible")

            _validar_cantidad_contra_stock_vendible(db, linea.id_producto, linea.cant)

            total += Decimal(str(linea.subtotal))

        now = datetime.now(timezone.utc)
        pedido = Pedido(
            id_usuario=effective_user_id,
            fecha_pedido=now,
            estado="pendiente_confirmacion",
            total=total,
            observaciones=observaciones,
        )
        db.add(pedido)
        db.flush()

        for linea in items:
            db.add(
                DetallePedido(
                    id_pedido=pedido.id,
                    id_producto=linea.id_producto,
                    cantidad=linea.cant,
                    precio_unitario=Decimal(str(linea.precio_unitario)),
                    subtotal=Decimal(str(linea.subtotal)),
                )
            )

        referencia_externa = f"LOCAL-{pedido.id}-{int(now.timestamp())}"
        pago = Pago(
            id_pedido=pedido.id,
            monto=total,
            metodo_pago=metodo_pago,
            estado_pago="pendiente",
            fecha_pago=now,
            referencia_externa=referencia_externa,
        )
        db.add(pago)

        carrito.id_usuario = effective_user_id
        carrito.id_pedido = pedido.id
        carrito.estado = False

        lineas = [
            "Hola! Quiero finalizar esta compra:",
            f"Pedido #{pedido.id}",
            "",
            "Detalle:",
        ]
        for linea in items:
            nombre = linea.producto.nombre if linea.producto else f"Producto {linea.id_producto}"
            lineas.append(
                f"- {linea.cant} x {nombre} ({linea.subtotal} ARS)"
            )
        lineas.extend(
            [
                "",
                f"Total: {total} ARS",
                f"Método de pago: {metodo_pago}",
            ]
        )
        if observaciones:
            lineas.append(f"Observaciones: {observaciones}")

        mensaje = "\n".join(lineas)
        phone = "".join(ch for ch in WHATSAPP_CHECKOUT_PHONE if ch.isdigit())
        whatsapp_url = f"https://wa.me/{phone}?text={quote(mensaje)}"

        db.commit()
        db.refresh(pedido)
        db.refresh(pago)
        return pedido, pago, whatsapp_url

    except IntegrityError:
        db.rollback()
        raise ValueError("No se pudo confirmar el checkout")
    except ValueError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise ValueError("Ocurrió un error al confirmar la compra")


def confirm_pedido(
    db: Session,
    id_pedido: int,
    force: bool = False,
    asignaciones_por_detalle: Optional[dict[int, list[int]]] = None,
) -> tuple[Optional[Pedido], list[str]]:
    """
    Confirma un pedido pendiente:
    - valida estado de equipos,
    - si hay items no inmediatos devuelve warnings para confirmar con el local,
    - al confirmar: reserva unidades (reservado_venta), aprueba pago; la venta cerrada es con finalizar_entrega_pedido.
    """
    try:
        pedido = db.query(Pedido).filter(Pedido.id == id_pedido).first()
        if not pedido:
            raise ValueError("Pedido no encontrado")
        if pedido.estado != "pendiente_confirmacion":
            raise ValueError(f"Pedido en estado {pedido.estado}, no se puede confirmar")

        detalles = db.query(DetallePedido).filter(DetallePedido.id_pedido == id_pedido).all()
        if not detalles:
            raise ValueError("El pedido no tiene detalle")

        warnings: list[str] = []
        cancel_reasons: list[str] = []

        equipos_a_reservar: list[Equipo] = []
        productos_afectados: set[int] = set()
        accesorio_a_descontar: list[tuple[int, int]] = []

        used_equipo_ids: set[int] = set()
        asignaciones_por_detalle = asignaciones_por_detalle or {}

        for detalle in detalles:
            qty = int(detalle.cantidad or 0)
            if qty < 1:
                continue

            if _hay_accesorio_para_producto(db, detalle.id_producto):
                acc = (
                    db.query(Accesorios)
                    .filter(Accesorios.id_producto == detalle.id_producto)
                    .first()
                )
                if not acc or not acc.estado:
                    cancel_reasons.append(
                        f"Accesorio inactivo o inexistente (producto {detalle.id_producto})."
                    )
                    continue
                producto_linea = (
                    db.query(Productos)
                    .filter(Productos.id == detalle.id_producto)
                    .first()
                )
                if not producto_linea or not producto_linea.activo:
                    cancel_reasons.append(
                        f"Producto {detalle.id_producto} no disponible para la venta."
                    )
                    continue
                disp = int(producto_linea.stock or 0)
                if disp < qty:
                    cancel_reasons.append(
                        f"Stock insuficiente para accesorio (producto {detalle.id_producto}): "
                        f"solicitado {qty}, disponible {disp}."
                    )
                    continue
                accesorio_a_descontar.append((int(detalle.id_producto), qty))
                productos_afectados.add(int(detalle.id_producto))
                continue

            equipos_producto = (
                db.query(Equipo)
                .filter(Equipo.id_producto == detalle.id_producto)
                .order_by(Equipo.id.asc())
                .all()
            )
            if not equipos_producto:
                cancel_reasons.append(
                    f"No hay equipo físico vinculado al producto {detalle.id_producto}."
                )
                continue

            elegibles = [eq for eq in equipos_producto if _equipo_es_vendible(eq)]

            if len(elegibles) < qty:
                cancel_reasons.append(
                    f"Stock insuficiente para producto {detalle.id_producto}: solicitado {qty}, disponible {len(elegibles)}."
                )
                continue

            seleccion_ids_raw = asignaciones_por_detalle.get(int(detalle.id))
            if seleccion_ids_raw is None:
                raise ValueError(
                    f"Debés asignar IMEI para el ítem #{detalle.id} (producto {detalle.id_producto}, cantidad {qty}) antes de confirmar."
                )

            seleccion_ids = [int(x) for x in seleccion_ids_raw if int(x) > 0]
            if len(seleccion_ids) != qty:
                raise ValueError(
                    f"El ítem #{detalle.id} requiere {qty} IMEI(s) y recibimos {len(seleccion_ids)}."
                )
            if len(set(seleccion_ids)) != len(seleccion_ids):
                raise ValueError(f"El ítem #{detalle.id} contiene IMEI/equipo duplicado en la asignación.")

            elegibles_por_id = {int(eq.id): eq for eq in elegibles}
            seleccionados: list[Equipo] = []
            for id_equipo in seleccion_ids:
                eq = elegibles_por_id.get(id_equipo)
                if eq is None:
                    raise ValueError(
                        f"El equipo #{id_equipo} no está disponible para el producto {detalle.id_producto} en el ítem #{detalle.id}."
                    )
                if id_equipo in used_equipo_ids:
                    raise ValueError(
                        f"El equipo #{id_equipo} se repite en más de un ítem del pedido; cada IMEI debe ser único."
                    )
                used_equipo_ids.add(id_equipo)
                seleccionados.append(eq)

            for equipo in seleccionados:
                estado_normalizado = (equipo.estado_comercial or "").strip().lower()
                requiere_verificacion = estado_normalizado in AVAILABILITY_CHECK_STATES
                if requiere_verificacion and not force:
                    nombre_producto = (
                        equipo.producto.nombre
                        if equipo.producto is not None and equipo.producto.nombre
                        else f"producto {detalle.id_producto}"
                    )
                    warnings.append(
                        "El ítem "
                        f"{nombre_producto} requiere confirmar disponibilidad con el local por WhatsApp antes de cerrar la venta."
                    )
                    break
            equipos_a_reservar.extend(seleccionados)
            productos_afectados.add(int(detalle.id_producto))

        if cancel_reasons:
            pedido.estado = "cancelado_sin_stock"
            pago = db.query(Pago).filter(Pago.id_pedido == id_pedido).first()
            if pago:
                pago.estado_pago = "rechazado"

            reason_text = " ".join(cancel_reasons)
            if pedido.observaciones:
                pedido.observaciones = f"{pedido.observaciones} | {reason_text}"
            else:
                pedido.observaciones = reason_text

            db.commit()
            db.refresh(pedido)
            return pedido, []

        if warnings:
            db.rollback()
            return None, warnings

        for id_producto, qty in accesorio_a_descontar:
            producto_acc = db.query(Productos).filter(Productos.id == id_producto).first()
            if not producto_acc:
                db.rollback()
                raise ValueError(f"Producto {id_producto} no encontrado al descontar accesorio.")
            resto = int(producto_acc.stock or 0) - qty
            if resto < 0:
                db.rollback()
                raise ValueError(
                    f"Stock inconsistente para producto {id_producto} al confirmar accesorios."
                )
            producto_acc.stock = resto

        for equipo in equipos_a_reservar:
            prev = (equipo.estado_comercial or "").strip() or None
            equipo.estado_comercial_previo_reserva = prev
            equipo.activo = False
            equipo.estado_comercial = RESERVADO_VENTA

        for id_producto in productos_afectados:
            _sincronizar_producto_activo_por_unidades_disponibles(db, id_producto)

        pedido.estado = "confirmado"
        pago = db.query(Pago).filter(Pago.id_pedido == id_pedido).first()
        if pago:
            pago.estado_pago = "aprobado"

        db.commit()
        db.refresh(pedido)
        return pedido, []

    except IntegrityError:
        db.rollback()
        raise ValueError("No se pudo confirmar el pedido")
    except ValueError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise ValueError("Ocurrió un error al confirmar el pedido")


def finalizar_entrega_pedido(db: Session, id_pedido: int) -> Pedido:
    """
    Cierra la venta en inventario: pasa equipos de reserva a vendido y desactiva el producto.
    Ejecutar cuando la unidad ya salió / se entregó (IMEI verificado en operación).
    """
    try:
        pedido = db.query(Pedido).filter(Pedido.id == id_pedido).first()
        if not pedido:
            raise ValueError("Pedido no encontrado")
        if pedido.estado != "confirmado":
            raise ValueError(
                f"Solo se puede finalizar entrega de pedidos confirmados (actual: {pedido.estado})."
            )

        detalles = db.query(DetallePedido).filter(DetallePedido.id_pedido == id_pedido).all()
        productos_afectados: set[int] = set()
        for detalle in detalles:
            equipo = db.query(Equipo).filter(Equipo.id_producto == detalle.id_producto).first()
            if not equipo:
                continue
            en = (equipo.estado_comercial or "").strip().lower()
            if en == RESERVADO_VENTA:
                equipo.estado_comercial = "vendido"
                equipo.estado_comercial_previo_reserva = None
                productos_afectados.add(int(detalle.id_producto))

        for id_producto in productos_afectados:
            _sincronizar_producto_activo_por_unidades_disponibles(db, id_producto)

        db.commit()
        db.refresh(pedido)
        return pedido

    except IntegrityError:
        db.rollback()
        raise ValueError("No se pudo finalizar la entrega")
    except ValueError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise ValueError("Ocurrió un error al finalizar la entrega")


def cancel_pedido_confirmado(db: Session, id_pedido: int, motivo: Optional[str] = None) -> Pedido:
    """Cancela un pedido ya confirmado y libera unidades reservadas (vuelven al stock vendible)."""
    try:
        pedido = db.query(Pedido).filter(Pedido.id == id_pedido).first()
        if not pedido:
            raise ValueError("Pedido no encontrado")
        if pedido.estado != "confirmado":
            raise ValueError(f"Pedido en estado {pedido.estado}, no aplica cancelación post-confirmación.")

        detalles = db.query(DetallePedido).filter(DetallePedido.id_pedido == id_pedido).all()
        hay_reserva_equipo = False
        hubo_rest_accesorio = False
        productos_afectados: set[int] = set()
        for detalle in detalles:
            qty = int(detalle.cantidad or 0)
            if qty < 1:
                continue
            if _hay_accesorio_para_producto(db, detalle.id_producto):
                producto_acc = (
                    db.query(Productos)
                    .filter(Productos.id == detalle.id_producto)
                    .first()
                )
                if producto_acc:
                    producto_acc.stock = int(producto_acc.stock or 0) + qty
                    hubo_rest_accesorio = True
                    productos_afectados.add(int(detalle.id_producto))
                continue
            equipo = db.query(Equipo).filter(Equipo.id_producto == detalle.id_producto).first()
            if not equipo:
                continue
            en = (equipo.estado_comercial or "").strip().lower()
            if en == RESERVADO_VENTA:
                hay_reserva_equipo = True
                prev = (equipo.estado_comercial_previo_reserva or "").strip() or None
                equipo.estado_comercial = prev if prev else "nuevo"
                equipo.estado_comercial_previo_reserva = None
                equipo.activo = True
                productos_afectados.add(int(detalle.id_producto))

        if not hay_reserva_equipo and not hubo_rest_accesorio:
            raise ValueError(
                "No hay unidades en reserva ni stock de accesorios para revertir en este pedido; "
                "puede que la entrega ya esté cerrada."
            )

        pedido.estado = "cancelado"

        pago = db.query(Pago).filter(Pago.id_pedido == id_pedido).first()
        if pago:
            pago.estado_pago = "rechazado"

        motivo_cancelacion = (
            (motivo or "").strip()
            or "Pedido confirmado cancelado desde administración; stock liberado."
        )
        if pedido.observaciones:
            pedido.observaciones = f"{pedido.observaciones} | {motivo_cancelacion}"
        else:
            pedido.observaciones = motivo_cancelacion

        for id_producto in productos_afectados:
            _sincronizar_producto_activo_por_unidades_disponibles(db, id_producto)

        db.commit()
        db.refresh(pedido)
        return pedido

    except IntegrityError:
        db.rollback()
        raise ValueError("No se pudo cancelar el pedido confirmado")
    except ValueError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise ValueError("Ocurrió un error al cancelar el pedido confirmado")


def cancel_pedido(
    db: Session,
    id_pedido: int,
    motivo: Optional[str] = None,
) -> Pedido:
    """Cancela manualmente un pedido pendiente de confirmación desde admin."""
    try:
        pedido = db.query(Pedido).filter(Pedido.id == id_pedido).first()
        if not pedido:
            raise ValueError("Pedido no encontrado")
        if pedido.estado != "pendiente_confirmacion":
            raise ValueError(f"Pedido en estado {pedido.estado}, no se puede cancelar")

        pedido.estado = "cancelado"

        pago = db.query(Pago).filter(Pago.id_pedido == id_pedido).first()
        if pago:
            pago.estado_pago = "rechazado"

        motivo_cancelacion = (
            (motivo or "").strip()
            or "Pedido cancelado desde administración (compra no realizada)."
        )
        if pedido.observaciones:
            pedido.observaciones = f"{pedido.observaciones} | {motivo_cancelacion}"
        else:
            pedido.observaciones = motivo_cancelacion

        db.commit()
        db.refresh(pedido)
        return pedido

    except IntegrityError:
        db.rollback()
        raise ValueError("No se pudo cancelar el pedido")
    except ValueError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise ValueError("Ocurrió un error al cancelar el pedido")


def _sincronizar_producto_activo_por_unidades_disponibles(db: Session, id_producto: int) -> None:
    """Mantiene `producto.activo` según stock de accesorio o unidades `equipo` vendibles."""
    db.flush()
    producto = db.query(Productos).filter(Productos.id == id_producto).first()
    if not producto:
        return
    if _hay_accesorio_para_producto(db, id_producto):
        acc = (
            db.query(Accesorios)
            .filter(Accesorios.id_producto == id_producto)
            .first()
        )
        producto.activo = bool(
            acc and acc.estado and int(producto.stock or 0) > 0
        )
        return
    hay_unidad_disponible = (
        db.query(Equipo.id)
        .filter(
            Equipo.id_producto == id_producto,
            Equipo.activo.is_(True),
        )
        .first()
        is not None
    )
    producto.activo = bool(hay_unidad_disponible)


def listar_candidatos_reasignacion_equipo(
    db: Session, id_pedido: int, id_producto: int
) -> list[dict]:
    pedido = db.query(Pedido).filter(Pedido.id == id_pedido).first()
    if not pedido:
        raise ValueError("Pedido no encontrado")
    if pedido.estado not in {"confirmado", "pendiente_confirmacion"}:
        raise ValueError("Solo se puede consultar IMEI para pedidos pendientes o confirmados.")

    detalle = (
        db.query(DetallePedido)
        .filter(DetallePedido.id_pedido == id_pedido, DetallePedido.id_producto == id_producto)
        .first()
    )
    if not detalle:
        raise ValueError("El producto no pertenece al pedido.")

    equipos = (
        db.query(Equipo)
        .options(joinedload(Equipo.modelo))
        .filter(Equipo.id_producto == id_producto)
        .order_by(Equipo.id.asc())
        .all()
    )
    out: list[dict] = []
    for eq in equipos:
        estado = (eq.estado_comercial or "").strip().lower()
        es_actual = estado == RESERVADO_VENTA
        disponible = bool(eq.activo) and estado not in BLOCKED_STATES
        out.append(
            {
                "id_equipo": int(eq.id),
                "imei": eq.imei,
                "estado_comercial": eq.estado_comercial,
                "activo": bool(eq.activo),
                "id_modelo": int(eq.id_modelo),
                "modelo": eq.modelo.nombre_modelo if eq.modelo else None,
                "capacidad_gb": eq.modelo.capacidad_gb if eq.modelo else None,
                "color": eq.color,
                "es_actual_reservado": es_actual,
                "disponible_para_reasignar": disponible,
            }
        )
    return out


def reasignar_equipo_reservado_en_pedido(
    db: Session,
    *,
    id_pedido: int,
    id_producto: int,
    id_equipo_nuevo: int,
    motivo: Optional[str] = None,
) -> Pedido:
    try:
        pedido = db.query(Pedido).filter(Pedido.id == id_pedido).first()
        if not pedido:
            raise ValueError("Pedido no encontrado")
        if pedido.estado != "confirmado":
            raise ValueError("Solo se puede reasignar IMEI en pedidos confirmados.")

        detalle = (
            db.query(DetallePedido)
            .filter(DetallePedido.id_pedido == id_pedido, DetallePedido.id_producto == id_producto)
            .first()
        )
        if not detalle:
            raise ValueError("El producto no pertenece al pedido.")
        if int(detalle.cantidad or 0) != 1:
            raise ValueError("La reasignación manual de IMEI aplica solo a líneas con cantidad 1.")

        equipo_actual = (
            db.query(Equipo)
            .filter(Equipo.id_producto == id_producto, Equipo.estado_comercial == RESERVADO_VENTA)
            .order_by(Equipo.id.asc())
            .first()
        )
        if not equipo_actual:
            raise ValueError("No hay un equipo reservado actualmente para este producto.")

        equipo_nuevo = db.query(Equipo).filter(Equipo.id == id_equipo_nuevo).first()
        if not equipo_nuevo:
            raise ValueError("El equipo nuevo no existe.")
        if int(equipo_nuevo.id_producto or -1) != int(id_producto):
            raise ValueError("El equipo nuevo debe pertenecer al mismo producto/modelo vendido.")
        if int(equipo_nuevo.id) == int(equipo_actual.id):
            raise ValueError("El equipo nuevo ya es el asignado actualmente.")

        estado_nuevo = (equipo_nuevo.estado_comercial or "").strip().lower()
        if (not bool(equipo_nuevo.activo)) or estado_nuevo in BLOCKED_STATES:
            raise ValueError("El equipo nuevo no está disponible para reasignar.")

        prev_actual = (equipo_actual.estado_comercial_previo_reserva or "").strip() or "nuevo"
        equipo_actual.estado_comercial = prev_actual
        equipo_actual.estado_comercial_previo_reserva = None
        equipo_actual.activo = True

        prev_nuevo = (equipo_nuevo.estado_comercial or "").strip() or None
        equipo_nuevo.estado_comercial_previo_reserva = prev_nuevo
        equipo_nuevo.estado_comercial = RESERVADO_VENTA
        equipo_nuevo.activo = False

        motivo_txt = (motivo or "").strip() or "Sin motivo informado"
        obs = (
            f"Reasignación de IMEI en pedido confirmado (producto {id_producto}): "
            f"equipo {equipo_actual.id} IMEI {equipo_actual.imei or 's/imei'} -> "
            f"equipo {equipo_nuevo.id} IMEI {equipo_nuevo.imei or 's/imei'}. Motivo: {motivo_txt}"
        )
        pedido.observaciones = f"{pedido.observaciones} | {obs}" if pedido.observaciones else obs

        _sincronizar_producto_activo_por_unidades_disponibles(db, int(id_producto))
        db.commit()
        db.refresh(pedido)
        return pedido
    except IntegrityError:
        db.rollback()
        raise ValueError("No se pudo reasignar el equipo del pedido")
    except ValueError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise ValueError("Ocurrió un error al reasignar el IMEI del pedido")
