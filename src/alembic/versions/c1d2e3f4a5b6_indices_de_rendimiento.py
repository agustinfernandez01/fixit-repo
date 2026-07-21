"""Índices de rendimiento sobre foreign keys y columnas de filtro frecuentes.

Postgres, a diferencia de MySQL, NO crea índices automáticos sobre las foreign keys.
Sin estos índices cada filtro por `equipos.id_producto` —el más frecuente de toda la
app— es un scan secuencial.

En Postgres se usa CREATE INDEX CONCURRENTLY para no bloquear las tablas en
producción; eso obliga a correr fuera de transacción (`autocommit_block`).

Revision ID: c1d2e3f4a5b6
Revises: a7f3c1d9e0b2
Create Date: 2026-07-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "a7f3c1d9e0b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (nombre_indice, tabla, [columnas tal cual van en el DDL])
INDICES: list[tuple[str, str, list[str]]] = [
    # equipos: filtro más caliente de la app (carrito, catálogo, pedidos, detalle).
    ("ix_equipos_id_producto", "equipos", ["id_producto"]),
    ("ix_equipos_id_modelo", "equipos", ["id_modelo"]),
    ("ix_equipos_activo", "equipos", ["activo"]),
    ("ix_equipos_estado_comercial", "equipos", ["estado_comercial"]),
    ("ix_equipos_reservado_pedido_id", "equipos", ["reservado_pedido_id"]),
    # carrito / pedidos
    ("ix_carrito_detalle_id_carrito", "carrito_detalle", ["id_carrito"]),
    ("ix_detalle_pedido_id_pedido", "detalle_pedido", ["id_pedido"]),
    ("ix_detalle_pedido_id_producto", "detalle_pedido", ["id_producto"]),
    ("ix_pagos_id_pedido", "pagos", ["id_pedido"]),
    # catálogo
    ("ix_accesorios_id_producto", "accesorios", ["id_producto"]),
    ("ix_productos_id_categoria", "productos", ["id_categoria"]),
    ("ix_productos_activo", "productos", ["activo"]),
    # panel admin: filtra por estado y ordena por id desc
    ("ix_pedidos_estado_id", "pedidos", ["estado", "id DESC"]),
    # marketplace
    ("ix_publicaciones_id_usuario", "publicaciones", ["id_usuario"]),
    ("ix_publicaciones_estado", "publicaciones", ["estado"]),
    ("ix_interes_publicacion_id_publicacion", "interes_publicacion", ["id_publicacion"]),
    ("ix_interes_publicacion_fecha_interes", "interes_publicacion", ["fecha_interes"]),
]


def _tablas_existentes() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    dialecto = bind.dialect.name.lower()
    tablas = _tablas_existentes()

    if dialecto == "postgresql":
        # CONCURRENTLY no puede correr dentro de una transacción.
        with op.get_context().autocommit_block():
            for nombre, tabla, columnas in INDICES:
                if tabla not in tablas:
                    continue
                cols = ", ".join(columnas)
                op.execute(
                    f'CREATE INDEX CONCURRENTLY IF NOT EXISTS {nombre} ON {tabla} ({cols})'
                )
        return

    # MySQL / SQLite: sin CONCURRENTLY ni IF NOT EXISTS; chequeamos con el inspector.
    inspector = sa.inspect(bind)
    for nombre, tabla, columnas in INDICES:
        if tabla not in tablas:
            continue
        existentes = {i["name"] for i in inspector.get_indexes(tabla)}
        if nombre in existentes:
            continue
        # `id DESC` es sintaxis de índice descendente; fuera de Postgres lo dejamos ascendente.
        cols = [c.split(" ")[0] for c in columnas]
        op.create_index(nombre, tabla, cols)


def downgrade() -> None:
    bind = op.get_bind()
    dialecto = bind.dialect.name.lower()
    tablas = _tablas_existentes()

    if dialecto == "postgresql":
        with op.get_context().autocommit_block():
            for nombre, tabla, _ in reversed(INDICES):
                if tabla in tablas:
                    op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {nombre}")
        return

    inspector = sa.inspect(bind)
    for nombre, tabla, _ in reversed(INDICES):
        if tabla not in tablas:
            continue
        if nombre in {i["name"] for i in inspector.get_indexes(tabla)}:
            op.drop_index(nombre, table_name=tabla)
