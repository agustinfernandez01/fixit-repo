"""
Tests de regresión de conteo de queries.

Son la única defensa real contra la reaparición de un N+1: no miden tiempo (que
depende de la máquina) sino cuántas queries emite cada flujo. La aserción clave no
es el número exacto, sino que **el conteo no crezca con la cantidad de filas**.

Ver `app/observabilidad.py` y la sección de rendimiento en CLAUDE.md.
"""
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 - registra todos los modelos
from app.db import Base
from app.models.accesorios import Accesorios
from app.models.carrito import Carrito, CarritoDetalle
from app.models.equipos import Equipo, ModeloEquipo
from app.models.pedido import DetallePedido, Pedido
from app.models.productos import CategoriaProducto, Productos
from app.models.roles import Rol
from app.models.usuarios import Usuario
from app.observabilidad import contar_queries, instalar_contador_de_queries
from app.services.carrito import (
    add_item_to_carrito,
    carrito_resumen,
    list_pedidos_pendientes_admin,
    unidades_vendibles_por_producto,
    unidades_vendibles_por_productos,
)


def _nueva_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    instalar_contador_de_queries(engine)
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)()


def _categoria(db) -> int:
    cat = CategoriaProducto(nombre="Cat", descripcion="", activo=True)
    db.add(cat)
    db.flush()
    return cat.id


def _producto_con_equipo(db, id_categoria: int, sufijo: str, unidades: int = 3) -> Productos:
    producto = Productos(
        nombre=f"iPhone {sufijo} 128GB",
        descripcion="",
        precio=Decimal("1000.00"),
        id_categoria=id_categoria,
        activo=True,
    )
    db.add(producto)
    db.flush()

    modelo = ModeloEquipo(nombre_modelo=f"iPhone {sufijo}", capacidad_gb=128, activo=True)
    db.add(modelo)
    db.flush()

    for n in range(unidades):
        db.add(
            Equipo(
                id_modelo=modelo.id,
                id_producto=producto.id,
                imei=f"{sufijo}{n:012d}"[:15],
                tipo_equipo="smartphone",
                estado_comercial="nuevo",
                activo=True,
            )
        )
    db.flush()
    return producto


def _producto_accesorio(db, id_categoria: int, sufijo: str, stock: int = 5) -> Productos:
    producto = Productos(
        nombre=f"Cable {sufijo}",
        descripcion="",
        precio=Decimal("50.00"),
        id_categoria=id_categoria,
        activo=True,
        stock=stock,
    )
    db.add(producto)
    db.flush()
    db.add(
        Accesorios(
            tipo="cable",
            nombre=f"USB {sufijo}",
            color="negro",
            descripcion="1m",
            estado=True,
            id_producto=producto.id,
        )
    )
    db.flush()
    return producto


def test_stock_batch_da_el_mismo_resultado_que_el_calculo_individual():
    """El batch no puede cambiar el stock reportado: es la garantía de no vender sin existencias."""
    db = _nueva_db()
    try:
        cat = _categoria(db)
        con_equipos = _producto_con_equipo(db, cat, "A", unidades=3)
        accesorio = _producto_accesorio(db, cat, "B", stock=7)
        accesorio_inactivo = _producto_accesorio(db, cat, "C", stock=4)
        db.query(Accesorios).filter(
            Accesorios.id_producto == accesorio_inactivo.id
        ).update({"estado": False})

        # Producto sin equipo ni accesorio → 0.
        huerfano = Productos(
            nombre="Servicio suelto",
            descripcion="",
            precio=Decimal("10.00"),
            id_categoria=cat,
            activo=True,
        )
        db.add(huerfano)

        # Equipos no vendibles (vendido / inactivo) no deben contarse.
        no_vendible = _producto_con_equipo(db, cat, "D", unidades=2)
        db.query(Equipo).filter(Equipo.id_producto == no_vendible.id).update(
            {"estado_comercial": "vendido"}
        )
        db.commit()

        ids = [
            con_equipos.id,
            accesorio.id,
            accesorio_inactivo.id,
            huerfano.id,
            no_vendible.id,
        ]
        batch = unidades_vendibles_por_productos(db, ids)
        individual = {i: unidades_vendibles_por_producto(db, i) for i in ids}

        assert batch == individual
        assert batch[con_equipos.id] == 3
        assert batch[accesorio.id] == 7
        assert batch[accesorio_inactivo.id] == 0
        assert batch[huerfano.id] == 0
        assert batch[no_vendible.id] == 0
    finally:
        db.close()


def test_resumen_de_carrito_no_escala_con_la_cantidad_de_items():
    """Regresión de N+1: el conteo debe ser el mismo con 2 ítems que con 8."""
    db = _nueva_db()
    try:
        cat = _categoria(db)
        # Ambos carritos mezclan equipo + accesorio para que recorran las mismas
        # ramas del cálculo de stock; lo único que cambia es la cantidad de ítems.
        productos = [_producto_con_equipo(db, cat, f"E{n}") for n in range(6)]
        productos += [_producto_accesorio(db, cat, f"F{n}") for n in range(2)]
        db.commit()

        for p in (productos[0], productos[-1]):
            add_item_to_carrito(db, "token-chico", p.id, 1)
        with contar_queries() as n_chico:
            carrito_resumen(db, "token-chico")

        for p in productos:
            add_item_to_carrito(db, "token-grande", p.id, 1)
        with contar_queries() as n_grande:
            carrito_resumen(db, "token-grande")

        assert n_chico() == n_grande(), (
            f"El resumen del carrito escala con la cantidad de ítems "
            f"({n_chico()} queries con 2 ítems vs {n_grande()} con {len(productos)}): hay un N+1."
        )
        # Techo absoluto: si esto se dispara, algo agregó queries al flujo.
        assert n_grande() <= 12
    finally:
        db.close()


def test_agregar_al_carrito_no_escala_con_el_tamano_del_carrito():
    db = _nueva_db()
    try:
        cat = _categoria(db)
        productos = [_producto_con_equipo(db, cat, f"G{n}") for n in range(8)]
        db.commit()

        # Los dos carritos ya existen antes de medir: crear el carrito cuesta queries
        # extra (INSERT) y falsearía la comparación.
        add_item_to_carrito(db, "token-chico-add", productos[0].id, 1)
        with contar_queries() as n_chico:
            add_item_to_carrito(db, "token-chico-add", productos[1].id, 1)

        for p in productos[2:7]:
            add_item_to_carrito(db, "token-add", p.id, 1)
        with contar_queries() as n_lleno:
            add_item_to_carrito(db, "token-add", productos[7].id, 1)

        assert n_chico() == n_lleno(), (
            f"Agregar al carrito escala con su tamaño "
            f"({n_chico()} queries con 1 ítem previo vs {n_lleno()} con 5)."
        )
        assert n_lleno() <= 10, f"Agregar un ítem al carrito hizo {n_lleno()} queries."
    finally:
        db.close()


def test_panel_de_pedidos_admin_no_escala_con_la_cantidad_de_pedidos():
    db = _nueva_db()
    try:
        cat = _categoria(db)
        rol = Rol(nombre="cliente")
        db.add(rol)
        db.flush()
        usuario = Usuario(
            nombre="Admin",
            apellido="Tester",
            email="perf@example.com",
            telefono="549111",
            password_hash="x",
            id_rol=rol.id,
        )
        db.add(usuario)
        db.flush()

        productos = [_producto_con_equipo(db, cat, f"H{n}") for n in range(4)]
        productos.append(_producto_accesorio(db, cat, "I0"))

        def _crear_pedido() -> None:
            pedido = Pedido(
                id_usuario=usuario.id,
                estado="pendiente_confirmacion",
                total=Decimal("1000.00"),
            )
            db.add(pedido)
            db.flush()
            for p in productos:
                db.add(
                    DetallePedido(
                        id_pedido=pedido.id,
                        id_producto=p.id,
                        cantidad=1,
                        precio_unitario=Decimal("1000.00"),
                        subtotal=Decimal("1000.00"),
                    )
                )

        _crear_pedido()
        db.commit()
        with contar_queries() as n_uno:
            list_pedidos_pendientes_admin(db, limit=50)

        for _ in range(9):
            _crear_pedido()
        db.commit()
        with contar_queries() as n_diez:
            resultado = list_pedidos_pendientes_admin(db, limit=50)

        assert len(resultado) == 10
        assert n_uno() == n_diez(), (
            f"El panel de pedidos escala con la cantidad de pedidos "
            f"({n_uno()} queries con 1 pedido vs {n_diez()} con 10): volvió el N+1."
        )
        assert n_diez() <= 6
    finally:
        db.close()


def test_carrito_vacio_no_consulta_stock():
    db = _nueva_db()
    try:
        Carrito(token_identificador="x", estado=True)
        carrito = Carrito(token_identificador="token-vacio", estado=True)
        db.add(carrito)
        db.commit()

        with contar_queries() as n:
            resumen = carrito_resumen(db, "token-vacio")

        assert resumen.items == []
        assert n() <= 3
    finally:
        db.close()


def test_detalle_de_carrito_reporta_stock_correcto_por_tipo():
    """El batch mezcla equipos y accesorios en el mismo carrito sin cruzar fuentes."""
    db = _nueva_db()
    try:
        cat = _categoria(db)
        equipo = _producto_con_equipo(db, cat, "J", unidades=2)
        accesorio = _producto_accesorio(db, cat, "K", stock=9)
        db.commit()

        add_item_to_carrito(db, "token-mix", equipo.id, 1)
        add_item_to_carrito(db, "token-mix", accesorio.id, 1)

        resumen = carrito_resumen(db, "token-mix")
        stock = {i.id_producto: i.stock_disponible for i in resumen.items}
        assert stock[equipo.id] == 2
        assert stock[accesorio.id] == 9
    finally:
        db.close()
