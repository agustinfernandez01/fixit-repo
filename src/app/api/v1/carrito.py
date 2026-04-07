"""API del carrito de compras."""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps.auth import get_optional_user_id_from_access_token
from app.schemas.carrito import (
    CarritoBase,
    CarritoDetalleBase,
    CarritoItemAdd,
    CarritoItemUpdate,
    CarritoResumen,
)
from app.services.carrito import (
    add_item_to_carrito,
    carrito_resumen,
    clear_carrito,
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