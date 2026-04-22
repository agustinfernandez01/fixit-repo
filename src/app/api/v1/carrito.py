"""API del carrito de compras."""

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.deps.auth import get_optional_user_id_from_access_token, require_admin_user_id
from app.models.pedido import DetallePedido, Pedido
from app.schemas.carrito import (
    CarritoBase,
    CarritoCheckoutRequest,
    CarritoCheckoutResponse,
    CarritoDetalleBase,
    CarritoItemAdd,
    CarritoItemUpdate,
    CarritoResumen,
)
from app.services.carrito import (
    add_item_to_carrito,
    cancel_pedido,
    carrito_resumen,
    checkout_carrito,
    clear_carrito,
    confirm_pedido,
    get_carrito_items,
    get_or_create_carrito,
    merge_guest_cart_into_user_cart,
    remove_line,
    update_line_quantity,
)

router = APIRouter()


def _require_carrito_token(
    x_carrito_token: str | None = Header(default=None, alias="X-Carrito-Token"),
) -> str:
    if not x_carrito_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Falta el token del carrito en X-Carrito-Token.",
        )
    return x_carrito_token


def _http_error_from_value_error(exc: ValueError) -> HTTPException:
    message = str(exc)
    lowered = message.lower()
    status_code = (
        status.HTTP_404_NOT_FOUND
        if "no encontrado" in lowered or "no encontrada" in lowered or "línea" in lowered or "linea" in lowered
        else status.HTTP_400_BAD_REQUEST
    )
    return HTTPException(status_code=status_code, detail=message)


@router.get("", response_model=CarritoResumen)
def obtener_resumen_carrito(
    db: Session = Depends(get_db),
    token: str = Depends(_require_carrito_token),
):
    try:
        return carrito_resumen(db, token)
    except ValueError as exc:
        raise _http_error_from_value_error(exc)


@router.post("", response_model=CarritoBase, status_code=status.HTTP_201_CREATED)
def crear_o_sincronizar_carrito(
    db: Session = Depends(get_db),
    token: str = Depends(_require_carrito_token),
    id_usuario: int | None = Depends(get_optional_user_id_from_access_token),
):
    try:
        if id_usuario is not None:
            carrito = merge_guest_cart_into_user_cart(db, token, id_usuario)
        else:
            carrito, _ = get_or_create_carrito(db, token)
        return carrito
    except ValueError as exc:
        raise _http_error_from_value_error(exc)


@router.get("/items", response_model=list[CarritoDetalleBase])
def listar_items_carrito(
    db: Session = Depends(get_db),
    token: str = Depends(_require_carrito_token),
):
    try:
        carrito = get_or_create_carrito(db, token)[0]
        return get_carrito_items(db, carrito.id)
    except ValueError as exc:
        raise _http_error_from_value_error(exc)


@router.post("/items", response_model=CarritoResumen, status_code=status.HTTP_201_CREATED)
def agregar_item_carrito(
    payload: CarritoItemAdd,
    db: Session = Depends(get_db),
    token: str = Depends(_require_carrito_token),
):
    try:
        add_item_to_carrito(db, token, payload.id_producto, payload.cant)
        return carrito_resumen(db, token)
    except ValueError as exc:
        raise _http_error_from_value_error(exc)


@router.patch("/items/{detalle_id}", response_model=CarritoResumen)
def actualizar_item_carrito(
    detalle_id: int,
    payload: CarritoItemUpdate,
    db: Session = Depends(get_db),
    token: str = Depends(_require_carrito_token),
):
    try:
        update_line_quantity(db, token, detalle_id, payload.cant)
        return carrito_resumen(db, token)
    except ValueError as exc:
        raise _http_error_from_value_error(exc)


@router.delete("/items/{detalle_id}", response_model=CarritoResumen)
def eliminar_item_carrito(
    detalle_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(_require_carrito_token),
):
    try:
        remove_line(db, token, detalle_id)
    except ValueError as exc:
        raise _http_error_from_value_error(exc)
    return carrito_resumen(db, token)


@router.delete("/items", response_model=CarritoResumen)
def vaciar_carrito(
    db: Session = Depends(get_db),
    token: str = Depends(_require_carrito_token),
):
    try:
        clear_carrito(db, token)
    except ValueError as exc:
        raise _http_error_from_value_error(exc)
    return carrito_resumen(db, token)


@router.post("/checkout", response_model=CarritoCheckoutResponse)
def confirmar_checkout(
    payload: CarritoCheckoutRequest,
    db: Session = Depends(get_db),
    token: str = Depends(_require_carrito_token),
    id_usuario: int | None = Depends(get_optional_user_id_from_access_token),
):
    if id_usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Debes iniciar sesión para confirmar la compra.",
        )
    try:
        pedido, pago, whatsapp_url = checkout_carrito(
            db,
            token=token,
            id_usuario=id_usuario,
            metodo_pago=payload.metodo_pago,
            observaciones=payload.observaciones,
        )
        return CarritoCheckoutResponse(
            id_pedido=pedido.id,
            id_pago=pago.id,
            estado_pedido=pedido.estado or "pendiente_confirmacion",
            estado_pago=pago.estado_pago or "pendiente",
            referencia_externa=pago.referencia_externa,
            whatsapp_url=whatsapp_url,
            total=pedido.total,
            mensaje="Pedido generado. Te redirigimos a WhatsApp para finalizar la compra.",
        )
    except ValueError as exc:
        raise _http_error_from_value_error(exc)


@router.post("/confirmar-pedido/{id_pedido}", response_model=dict)
def confirmar_pedido_endpoint(
    id_pedido: int,
    db: Session = Depends(get_db),
    force: bool = Query(False, description="Confirma aunque requiera validación comercial"),
    _id_admin: int = Depends(require_admin_user_id),
):
    """Admin endpoint: confirma pedido pendiente, bloquea stock, aprueba pago."""
    try:
        pedido, warnings = confirm_pedido(db, id_pedido, force=force)

        if warnings:
            return {
                "id_pedido": id_pedido,
                "estado": "requiere_verificacion_whatsapp",
                "mensaje": "Este pedido requiere confirmar disponibilidad con el local por WhatsApp.",
                "warnings": warnings,
            }

        if pedido.estado == "cancelado_sin_stock":
            return {
                "id_pedido": pedido.id,
                "estado": pedido.estado,
                "mensaje": "Pedido cancelado automáticamente por falta de stock/disponibilidad.",
                "warnings": [],
            }

        return {
            "id_pedido": pedido.id,
            "estado": pedido.estado,
            "mensaje": "Pedido confirmado y stock bloqueado.",
            "warnings": [],
        }
    except ValueError as exc:
        raise _http_error_from_value_error(exc)


@router.post("/cancelar-pedido/{id_pedido}", response_model=dict)
def cancelar_pedido_endpoint(
    id_pedido: int,
    db: Session = Depends(get_db),
    motivo: str | None = Query(None, description="Motivo de cancelación"),
    _id_admin: int = Depends(require_admin_user_id),
):
    """Admin endpoint: cancela un pedido pendiente de confirmación."""
    try:
        pedido = cancel_pedido(db, id_pedido=id_pedido, motivo=motivo)
        return {
            "id_pedido": pedido.id,
            "estado": pedido.estado,
            "mensaje": "Pedido cancelado. Compra no realizada.",
            "warnings": [],
        }
    except ValueError as exc:
        raise _http_error_from_value_error(exc)


@router.get("/pedidos-pendientes", response_model=list[dict])
def listar_pedidos_pendientes(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    _id_admin: int = Depends(require_admin_user_id),
):
    """Admin endpoint: lista pedidos pendientes de confirmación."""
    try:
        pedidos = (
            db.query(Pedido)
            .filter(Pedido.estado == "pendiente_confirmacion")
            .options(
                joinedload(Pedido.usuario),
                joinedload(Pedido.detalle_pedido).joinedload(DetallePedido.producto),
            )
            .order_by(Pedido.fecha_pedido.desc(), Pedido.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return [
            {
                "id_pedido": p.id,
                "id_usuario": p.id_usuario,
                "fecha_pedido": p.fecha_pedido,
                "estado": p.estado,
                "total": str(p.total) if p.total else "0",
                "observaciones": p.observaciones,
                "cliente": {
                    "id": p.usuario.id if p.usuario else p.id_usuario,
                    "nombre": " ".join(
                        part
                        for part in [
                            (p.usuario.nombre if p.usuario else None),
                            (p.usuario.apellido if p.usuario else None),
                        ]
                        if part and part.strip()
                    )
                    or None,
                    "email": p.usuario.email if p.usuario else None,
                    "telefono": p.usuario.telefono if p.usuario else None,
                },
                "items": [
                    {
                        "id_producto": item.id_producto,
                        "producto_nombre": item.producto.nombre if item.producto else f"Producto #{item.id_producto}",
                        "cantidad": item.cantidad,
                        "precio_unitario": str(item.precio_unitario) if item.precio_unitario else "0",
                        "subtotal": str(item.subtotal) if item.subtotal else "0",
                    }
                    for item in p.detalle_pedido
                ],
                "resumen": {
                    "total_items": len(p.detalle_pedido),
                    "total_unidades": sum(item.cantidad or 0 for item in p.detalle_pedido),
                },
            }
            for p in pedidos
        ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))