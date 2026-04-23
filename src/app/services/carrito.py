from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from urllib.parse import quote

from sqlalchemy import func
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
from app.schemas.carrito import CarritoResumen


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

BLOCKED_STATES = {"vendido", "cancelado", "baja"}

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
    return db.query(Carrito).filter(
        Carrito.token_identificador == token,
        Carrito.estado.is_(True),
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
            linea_existente.cant = nueva_cant
            linea_existente.subtotal = precio_unit * nueva_cant
            db.commit()
            db.refresh(linea_existente)
            return linea_existente

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


def carrito_resumen(db: Session, token: str) -> CarritoResumen:
    carrito = get_carrito_by_token(db, token)
    if not carrito:
        raise ValueError("Carrito no encontrado")

    items = get_carrito_items(db, carrito.id)
    total_unidades = sum(d.cant for d in items) if items else 0
    total_importe = sum(
        (Decimal(str(d.subtotal)) for d in items),
        start=Decimal("0"),
    )

    return CarritoResumen(
        carrito=carrito,
        items=items,
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
                Carrito.estado.is_(True),
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
                existente.cant = nueva_cant
                pu = Decimal(str(existente.precio_unitario))
                existente.subtotal = pu * nueva_cant
                db.delete(linea)
            else:
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
    - registra pago aprobado,
    - marca equipos vendidos para evitar sobreventa.
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


def confirm_pedido(db: Session, id_pedido: int, force: bool = False) -> tuple[Optional[Pedido], list[str]]:
    """
    Confirma un pedido pendiente:
    - valida estado de equipos,
    - si hay items no inmediatos devuelve warnings para confirmar con el local,
    - al confirmar, bloquea stock, marca pedido y pago.
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

        for detalle in detalles:
            equipo = (
                db.query(Equipo)
                .filter(Equipo.id_producto == detalle.id_producto)
                .first()
            )

            if not equipo:
                cancel_reasons.append(
                    f"No hay equipo físico vinculado al producto {detalle.id_producto}."
                )
                continue

            estado_normalizado = (equipo.estado_comercial or "").strip().lower()

            if estado_normalizado in BLOCKED_STATES:
                cancel_reasons.append(
                    f"El equipo {equipo.id} no está disponible para confirmar (estado: {equipo.estado_comercial})."
                )
                continue

            requiere_verificacion = (
                estado_normalizado in AVAILABILITY_CHECK_STATES
                or not bool(equipo.activo)
            )

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

        for detalle in detalles:
            equipo = (
                db.query(Equipo)
                .filter(Equipo.id_producto == detalle.id_producto)
                .first()
            )
            if equipo:
                equipo.activo = False
                equipo.estado_comercial = "vendido"
                if equipo.producto is not None:
                    equipo.producto.activo = False

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
