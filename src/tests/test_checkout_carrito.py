from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 - registra todos los modelos
from app.db import Base
from app.models.carrito import Carrito, CarritoDetalle
from app.models.pedido import DetallePedido, Pedido
from app.models.accesorios import Accesorios
from app.models.equipos import Equipo, ModeloEquipo
from app.models.productos import CategoriaProducto, Productos
from app.models.roles import Rol
from app.models.usuarios import Usuario
from app.services.carrito import (
    RESERVADO_VENTA,
    add_item_to_carrito,
    cancel_pedido,
    cancel_pedido_confirmado,
    checkout_carrito,
    confirm_pedido,
    finalizar_entrega_pedido,
)


def test_checkout_carrito_generates_whatsapp_and_defers_stock_lock_until_confirm():
    engine = create_engine("sqlite:///:memory:")
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        rol = Rol(nombre="cliente")
        db.add(rol)
        db.flush()

        usuario = Usuario(
            nombre="Ana",
            apellido="Tester",
            email="ana@example.com",
            telefono="5491111111111",
            password_hash="x",
            id_rol=rol.id,
        )
        db.add(usuario)
        db.flush()

        categoria = CategoriaProducto(nombre="Smartphones", descripcion="", activo=True)
        db.add(categoria)
        db.flush()

        producto = Productos(
            nombre="iPhone 14 128GB",
            descripcion="",
            precio=Decimal("1000.00"),
            id_categoria=categoria.id,
            activo=True,
        )
        db.add(producto)
        db.flush()

        modelo = ModeloEquipo(nombre_modelo="iPhone 14", capacidad_gb=128, color="Negro", activo=True)
        db.add(modelo)
        db.flush()

        equipo = Equipo(
            id_modelo=modelo.id,
            id_producto=producto.id,
            imei="123456789012345",
            tipo_equipo="smartphone",
            estado_comercial="nuevo",
            activo=True,
        )
        db.add(equipo)
        db.flush()

        carrito = Carrito(token_identificador="token-test", estado=True)
        db.add(carrito)
        db.flush()

        linea = CarritoDetalle(
            id_carrito=carrito.id,
            id_producto=producto.id,
            cant=1,
            precio_unitario=Decimal("1000.00"),
            subtotal=Decimal("1000.00"),
        )
        db.add(linea)
        db.commit()

        pedido, pago, whatsapp_url = checkout_carrito(
            db,
            token="token-test",
            id_usuario=usuario.id,
            metodo_pago="transferencia",
        )

        assert pedido.id is not None
        assert pedido.estado == "pendiente_confirmacion"
        assert pago.id is not None
        assert pago.estado_pago == "pendiente"

        db.refresh(carrito)
        db.refresh(equipo)
        db.refresh(producto)
        assert carrito.estado is False
        assert carrito.id_pedido == pedido.id
        assert equipo.activo is True
        assert equipo.estado_comercial == "nuevo"
        assert producto.activo is True

        assert whatsapp_url.startswith("https://wa.me/")
        assert "Pedido%20%23" in whatsapp_url
        assert "iPhone%2014%20128GB" in whatsapp_url

        det = db.query(DetallePedido).filter(DetallePedido.id_pedido == pedido.id).one()
        confirmed_pedido, warnings = confirm_pedido(
            db, pedido.id, asignaciones_por_detalle={det.id: [equipo.id]}
        )
        assert confirmed_pedido is not None
        assert warnings == []

        db.refresh(equipo)
        db.refresh(producto)
        assert confirmed_pedido.estado == "confirmado"
        assert equipo.activo is False
        assert equipo.estado_comercial == RESERVADO_VENTA
        assert equipo.estado_comercial_previo_reserva == "nuevo"
        assert producto.activo is False

        cerrado = finalizar_entrega_pedido(db, pedido.id)
        assert cerrado.estado == "confirmado"
        db.refresh(equipo)
        db.refresh(producto)
        assert equipo.estado_comercial == "vendido"
        assert equipo.estado_comercial_previo_reserva is None
        assert producto.activo is False
    finally:
        db.close()


def test_confirm_pedido_requires_whatsapp_availability_check_before_force():
    engine = create_engine("sqlite:///:memory:")
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        rol = Rol(nombre="cliente")
        db.add(rol)
        db.flush()

        usuario = Usuario(
            nombre="Luis",
            apellido="Tester",
            email="luis@example.com",
            telefono="5491111111112",
            password_hash="x",
            id_rol=rol.id,
        )
        db.add(usuario)
        db.flush()

        categoria = CategoriaProducto(nombre="Smartphones", descripcion="", activo=True)
        db.add(categoria)
        db.flush()

        producto = Productos(
            nombre="Samsung S22 128GB",
            descripcion="",
            precio=Decimal("1200.00"),
            id_categoria=categoria.id,
            activo=True,
        )
        db.add(producto)
        db.flush()

        modelo = ModeloEquipo(nombre_modelo="Samsung S22", capacidad_gb=128, color="Negro", activo=True)
        db.add(modelo)
        db.flush()

        equipo = Equipo(
            id_modelo=modelo.id,
            id_producto=producto.id,
            imei="223456789012345",
            tipo_equipo="smartphone",
            estado_comercial="reservado",
            activo=True,
        )
        db.add(equipo)
        db.flush()

        carrito = Carrito(token_identificador="token-test-2", estado=True)
        db.add(carrito)
        db.flush()

        linea = CarritoDetalle(
            id_carrito=carrito.id,
            id_producto=producto.id,
            cant=1,
            precio_unitario=Decimal("1200.00"),
            subtotal=Decimal("1200.00"),
        )
        db.add(linea)
        db.commit()

        pedido, _, _ = checkout_carrito(
            db,
            token="token-test-2",
            id_usuario=usuario.id,
            metodo_pago="transferencia",
        )

        det = db.query(DetallePedido).filter(DetallePedido.id_pedido == pedido.id).one()
        assign = {det.id: [equipo.id]}
        pending_pedido, warnings = confirm_pedido(
            db, pedido.id, force=False, asignaciones_por_detalle=assign
        )
        assert pending_pedido is None
        assert warnings
        assert "WhatsApp" in warnings[0]

        confirmed_pedido, forced_warnings = confirm_pedido(
            db, pedido.id, force=True, asignaciones_por_detalle=assign
        )
        assert confirmed_pedido is not None
        assert forced_warnings == []
        assert confirmed_pedido.estado == "confirmado"

        db.refresh(equipo)
        assert equipo.activo is False
        assert equipo.estado_comercial == RESERVADO_VENTA
    finally:
        db.close()


def test_confirm_pedido_auto_cancels_when_stock_is_already_sold():
    engine = create_engine("sqlite:///:memory:")
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        rol = Rol(nombre="cliente")
        db.add(rol)
        db.flush()

        usuario = Usuario(
            nombre="Marta",
            apellido="Tester",
            email="marta@example.com",
            telefono="5491111111113",
            password_hash="x",
            id_rol=rol.id,
        )
        db.add(usuario)
        db.flush()

        categoria = CategoriaProducto(nombre="Smartphones", descripcion="", activo=True)
        db.add(categoria)
        db.flush()

        producto = Productos(
            nombre="Moto Edge",
            descripcion="",
            precio=Decimal("900.00"),
            id_categoria=categoria.id,
            activo=True,
        )
        db.add(producto)
        db.flush()

        modelo = ModeloEquipo(nombre_modelo="Moto Edge", capacidad_gb=256, color="Azul", activo=True)
        db.add(modelo)
        db.flush()

        equipo = Equipo(
            id_modelo=modelo.id,
            id_producto=producto.id,
            imei="323456789012345",
            tipo_equipo="smartphone",
            estado_comercial="nuevo",
            activo=True,
        )
        db.add(equipo)
        db.flush()

        carrito = Carrito(token_identificador="token-test-3", estado=True)
        db.add(carrito)
        db.flush()

        linea = CarritoDetalle(
            id_carrito=carrito.id,
            id_producto=producto.id,
            cant=1,
            precio_unitario=Decimal("900.00"),
            subtotal=Decimal("900.00"),
        )
        db.add(linea)
        db.commit()

        pedido, _, _ = checkout_carrito(
            db,
            token="token-test-3",
            id_usuario=usuario.id,
            metodo_pago="transferencia",
        )

        # Simula que la unidad se vendió antes de que el admin confirme este pedido.
        equipo.estado_comercial = "vendido"
        equipo.activo = False
        db.commit()

        processed_pedido, warnings = confirm_pedido(db, pedido.id, force=False)
        assert processed_pedido is not None
        assert warnings == []
        assert processed_pedido.estado == "cancelado_sin_stock"
    finally:
        db.close()


def test_add_item_accesorio_sin_equipo_usa_stock_de_accesorios():
    engine = create_engine("sqlite:///:memory:")
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        categoria = CategoriaProducto(nombre="Acc", descripcion="", activo=True)
        db.add(categoria)
        db.flush()

        producto = Productos(
            nombre="Funda USB-C",
            descripcion="",
            precio=Decimal("50.00"),
            id_categoria=categoria.id,
            activo=True,
            stock=1,
        )
        db.add(producto)
        db.flush()

        acc = Accesorios(
            tipo="cable",
            nombre="USB-C",
            color="negro",
            descripcion="1m",
            estado=True,
            id_producto=producto.id,
        )
        db.add(acc)
        db.commit()

        add_item_to_carrito(db, "token-acc-1", producto.id, 1)
        with pytest.raises(ValueError, match="Stock insuficiente"):
            add_item_to_carrito(db, "token-acc-1", producto.id, 1)
    finally:
        db.close()


def test_confirm_pedido_solo_accesorio_desconta_stock_en_productos():
    engine = create_engine("sqlite:///:memory:")
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        rol = Rol(nombre="cliente")
        db.add(rol)
        db.flush()

        usuario = Usuario(
            nombre="Acc",
            apellido="Tester",
            email="acc@example.com",
            telefono="5491111111120",
            password_hash="x",
            id_rol=rol.id,
        )
        db.add(usuario)
        db.flush()

        categoria = CategoriaProducto(nombre="Acc", descripcion="", activo=True)
        db.add(categoria)
        db.flush()

        producto = Productos(
            nombre="Cable tipo C",
            descripcion="",
            precio=Decimal("40.00"),
            id_categoria=categoria.id,
            activo=True,
            stock=5,
        )
        db.add(producto)
        db.flush()

        acc = Accesorios(
            tipo="cable",
            nombre="USB",
            color="negro",
            descripcion="2m",
            estado=True,
            id_producto=producto.id,
        )
        db.add(acc)
        db.flush()

        carrito = Carrito(token_identificador="token-acc-confirm", estado=True)
        db.add(carrito)
        db.flush()

        linea = CarritoDetalle(
            id_carrito=carrito.id,
            id_producto=producto.id,
            cant=2,
            precio_unitario=Decimal("40.00"),
            subtotal=Decimal("80.00"),
        )
        db.add(linea)
        db.commit()

        pedido, _, _ = checkout_carrito(
            db,
            token="token-acc-confirm",
            id_usuario=usuario.id,
            metodo_pago="transferencia",
        )

        confirmed, warnings = confirm_pedido(
            db,
            pedido.id,
            force=False,
            asignaciones_por_detalle={},
        )
        assert confirmed is not None
        assert warnings == []
        assert confirmed.estado == "confirmado"

        db.refresh(producto)
        assert int(producto.stock or 0) == 3
    finally:
        db.close()


def test_add_item_rejects_when_qty_exceeds_vendible_stock():
    engine = create_engine("sqlite:///:memory:")
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        rol = Rol(nombre="cliente")
        db.add(rol)
        db.flush()

        categoria = CategoriaProducto(nombre="Cat", descripcion="", activo=True)
        db.add(categoria)
        db.flush()

        producto = Productos(
            nombre="Pixel 8",
            descripcion="",
            precio=Decimal("800.00"),
            id_categoria=categoria.id,
            activo=True,
        )
        db.add(producto)
        db.flush()

        modelo = ModeloEquipo(nombre_modelo="Pixel 8", capacidad_gb=128, color="Negro", activo=True)
        db.add(modelo)
        db.flush()

        equipo = Equipo(
            id_modelo=modelo.id,
            id_producto=producto.id,
            imei="423456789012345",
            tipo_equipo="smartphone",
            estado_comercial="nuevo",
            activo=True,
        )
        db.add(equipo)
        db.commit()

        add_item_to_carrito(db, "token-cart-stock", producto.id, 1)
        with pytest.raises(ValueError, match="Stock insuficiente"):
            add_item_to_carrito(db, "token-cart-stock", producto.id, 1)
    finally:
        db.close()


def test_checkout_rejects_when_cart_qty_exceeds_vendible_stock():
    engine = create_engine("sqlite:///:memory:")
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        rol = Rol(nombre="cliente")
        db.add(rol)
        db.flush()

        usuario = Usuario(
            nombre="Zoe",
            apellido="Tester",
            email="zoe@example.com",
            telefono="5491111111119",
            password_hash="x",
            id_rol=rol.id,
        )
        db.add(usuario)
        db.flush()

        categoria = CategoriaProducto(nombre="Cat", descripcion="", activo=True)
        db.add(categoria)
        db.flush()

        producto = Productos(
            nombre="Pixel 9",
            descripcion="",
            precio=Decimal("900.00"),
            id_categoria=categoria.id,
            activo=True,
        )
        db.add(producto)
        db.flush()

        modelo = ModeloEquipo(nombre_modelo="Pixel 9", capacidad_gb=256, color="Blanco", activo=True)
        db.add(modelo)
        db.flush()

        equipo = Equipo(
            id_modelo=modelo.id,
            id_producto=producto.id,
            imei="523456789012345",
            tipo_equipo="smartphone",
            estado_comercial="nuevo",
            activo=True,
        )
        db.add(equipo)
        db.flush()

        carrito = Carrito(token_identificador="token-cart-checkout-2", estado=True)
        db.add(carrito)
        db.flush()

        linea = CarritoDetalle(
            id_carrito=carrito.id,
            id_producto=producto.id,
            cant=2,
            precio_unitario=Decimal("900.00"),
            subtotal=Decimal("1800.00"),
        )
        db.add(linea)
        db.commit()

        with pytest.raises(ValueError, match="Stock insuficiente"):
            checkout_carrito(
                db,
                token="token-cart-checkout-2",
                id_usuario=usuario.id,
                metodo_pago="transferencia",
            )
    finally:
        db.close()


def test_cancel_pedido_confirmado_libera_reserva():
    engine = create_engine("sqlite:///:memory:")
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        rol = Rol(nombre="cliente")
        db.add(rol)
        db.flush()

        usuario = Usuario(
            nombre="Nico",
            apellido="Tester",
            email="nico@example.com",
            telefono="5491111111115",
            password_hash="x",
            id_rol=rol.id,
        )
        db.add(usuario)
        db.flush()

        categoria = CategoriaProducto(nombre="Smartphones", descripcion="", activo=True)
        db.add(categoria)
        db.flush()

        producto = Productos(
            nombre="OnePlus 12",
            descripcion="",
            precio=Decimal("1300.00"),
            id_categoria=categoria.id,
            activo=True,
        )
        db.add(producto)
        db.flush()

        modelo = ModeloEquipo(nombre_modelo="OnePlus 12", capacidad_gb=256, color="Verde", activo=True)
        db.add(modelo)
        db.flush()

        equipo = Equipo(
            id_modelo=modelo.id,
            id_producto=producto.id,
            imei="523456789012345",
            tipo_equipo="smartphone",
            estado_comercial="nuevo",
            activo=True,
        )
        db.add(equipo)
        db.flush()

        carrito = Carrito(token_identificador="token-test-5", estado=True)
        db.add(carrito)
        db.flush()

        linea = CarritoDetalle(
            id_carrito=carrito.id,
            id_producto=producto.id,
            cant=1,
            precio_unitario=Decimal("1300.00"),
            subtotal=Decimal("1300.00"),
        )
        db.add(linea)
        db.commit()

        pedido, _, _ = checkout_carrito(
            db,
            token="token-test-5",
            id_usuario=usuario.id,
            metodo_pago="transferencia",
        )
        det = db.query(DetallePedido).filter(DetallePedido.id_pedido == pedido.id).one()
        confirm_pedido(
            db, pedido.id, force=True, asignaciones_por_detalle={det.id: [equipo.id]}
        )
        db.refresh(equipo)
        assert equipo.estado_comercial == RESERVADO_VENTA

        cancel_pedido_confirmado(db, pedido.id, motivo="Cliente arrepentido")
        db.refresh(equipo)
        db.refresh(producto)
        p_db = db.query(Pedido).filter(Pedido.id == pedido.id).first()
        assert p_db is not None
        assert p_db.estado == "cancelado"
        assert equipo.activo is True
        assert equipo.estado_comercial == "nuevo"
        assert equipo.estado_comercial_previo_reserva is None
        assert producto.activo is True
    finally:
        db.close()


def test_cancel_pedido_marks_order_as_cancelado_and_pago_rechazado():
    engine = create_engine("sqlite:///:memory:")
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        rol = Rol(nombre="cliente")
        db.add(rol)
        db.flush()

        usuario = Usuario(
            nombre="Sofia",
            apellido="Tester",
            email="sofia@example.com",
            telefono="5491111111114",
            password_hash="x",
            id_rol=rol.id,
        )
        db.add(usuario)
        db.flush()

        categoria = CategoriaProducto(nombre="Smartphones", descripcion="", activo=True)
        db.add(categoria)
        db.flush()

        producto = Productos(
            nombre="Pixel 8",
            descripcion="",
            precio=Decimal("1100.00"),
            id_categoria=categoria.id,
            activo=True,
        )
        db.add(producto)
        db.flush()

        modelo = ModeloEquipo(nombre_modelo="Pixel 8", capacidad_gb=128, color="Negro", activo=True)
        db.add(modelo)
        db.flush()

        equipo = Equipo(
            id_modelo=modelo.id,
            id_producto=producto.id,
            imei="423456789012345",
            tipo_equipo="smartphone",
            estado_comercial="nuevo",
            activo=True,
        )
        db.add(equipo)
        db.flush()

        carrito = Carrito(token_identificador="token-test-4", estado=True)
        db.add(carrito)
        db.flush()

        linea = CarritoDetalle(
            id_carrito=carrito.id,
            id_producto=producto.id,
            cant=1,
            precio_unitario=Decimal("1100.00"),
            subtotal=Decimal("1100.00"),
        )
        db.add(linea)
        db.commit()

        pedido, pago, _ = checkout_carrito(
            db,
            token="token-test-4",
            id_usuario=usuario.id,
            metodo_pago="transferencia",
        )

        cancelled = cancel_pedido(
            db,
            id_pedido=pedido.id,
            motivo="Cliente no respondió por WhatsApp.",
        )

        db.refresh(pago)
        db.refresh(equipo)
        db.refresh(producto)

        assert cancelled.estado == "cancelado"
        assert "Cliente no respondió por WhatsApp." in (cancelled.observaciones or "")
        assert pago.estado_pago == "rechazado"
        assert equipo.activo is True
        assert equipo.estado_comercial == "nuevo"
        assert producto.activo is True
    finally:
        db.close()
