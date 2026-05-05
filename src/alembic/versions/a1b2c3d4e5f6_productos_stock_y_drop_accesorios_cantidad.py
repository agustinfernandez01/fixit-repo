"""Productos: stock entero; accesorios: quitar columna cantidad (si existe)

Revision ID: a1b2c3d4e5f6
Revises: f2b8d1c4a9e7
Create Date: 2026-05-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f2b8d1c4a9e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "productos" in tables:
        cols = {c.get("name") for c in inspector.get_columns("productos")}
        if "stock" not in cols:
            op.add_column(
                "productos",
                sa.Column("stock", sa.Integer(), nullable=False, server_default="0"),
            )
            # Quitar default de servidor para futuras inserciones vía ORM
            with op.batch_alter_table("productos") as batch:
                batch.alter_column("stock", server_default=None)

    if "accesorios" in tables:
        cols_a = {c.get("name") for c in inspector.get_columns("accesorios")}
        if "cantidad" in cols_a and "productos" in tables:
            # Pasar inventario de accesorios.cantidad -> productos.stock (suma por si hay varias filas)
            bind.execute(
                sa.text(
                    """
                    UPDATE productos
                    SET stock = COALESCE((
                        SELECT SUM(COALESCE(a.cantidad, 0))
                        FROM accesorios a
                        WHERE a.id_producto = productos.id
                    ), stock)
                    WHERE EXISTS (SELECT 1 FROM accesorios a WHERE a.id_producto = productos.id)
                    """
                )
            )
            op.drop_column("accesorios", "cantidad")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "accesorios" in tables:
        cols_a = {c.get("name") for c in inspector.get_columns("accesorios")}
        if "cantidad" not in cols_a:
            op.add_column(
                "accesorios",
                sa.Column("cantidad", sa.Integer(), nullable=True, server_default="0"),
            )
            with op.batch_alter_table("accesorios") as batch:
                batch.alter_column("cantidad", server_default=None)

    if "productos" in tables:
        cols = {c.get("name") for c in inspector.get_columns("productos")}
        if "stock" in cols:
            op.drop_column("productos", "stock")
