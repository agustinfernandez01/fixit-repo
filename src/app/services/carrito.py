from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.accesorios import Accesorios
from app.models.carrito import Carrito, CarritoDetalle
from app.models.equipos import Equipo
from app.models.productos import Productos
from app.schemas.carrito import CarritoResumen


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
        db.query(Equipo.id, Equipo.id_producto)
        .filter(Equipo.id_producto.in_(product_ids))
        .all()
    )
    equipo_por_producto = {id_producto: id_equipo for id_equipo, id_producto in equipos_rows}

    accesorios_rows = (
        db.query(Accesorios.id, Accesorios.id_producto)
        .filter(Accesorios.id_producto.in_(product_ids))
        .all()
    )
    accesorio_por_producto = {}
    for id_accesorio, id_producto in accesorios_rows:
        if id_producto not in accesorio_por_producto:
            accesorio_por_producto[id_producto] = id_accesorio

    for detalle in items:
        if not detalle.producto:
            continue
        detalle.producto.tipo_producto = None
        detalle.producto.id_origen = None
        if detalle.id_producto in equipo_por_producto:
            detalle.producto.tipo_producto = "equipo"
            detalle.producto.id_origen = equipo_por_producto[detalle.id_producto]
        elif detalle.id_producto in accesorio_por_producto:
            detalle.producto.tipo_producto = "accesorio"
            detalle.producto.id_origen = accesorio_por_producto[detalle.id_producto]

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
        guest = _require_carrito_por_token(db, guest_token)
        if guest.id_usuario is not None and guest.id_usuario != id_usuario:
            raise ValueError("El carrito ya pertenece a otro usuario")

        user_cart = (
            db.query(Carrito)
            .filter(
                Carrito.id_usuario == id_usuario,
                Carrito.estado.is_(True),
                Carrito.id_pedido.is_(None),
            )
            .first()
        )

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
