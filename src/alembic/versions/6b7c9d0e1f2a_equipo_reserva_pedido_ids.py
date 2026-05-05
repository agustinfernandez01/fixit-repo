"""equipos reserva: vinculo a pedido/detalle

Revision ID: 6b7c9d0e1f2a
Revises: c8a1b2d3e4f5
Create Date: 2026-05-05 12:55:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6b7c9d0e1f2a"
down_revision: Union[str, Sequence[str], None] = "c8a1b2d3e4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "equipos" not in tables:
        return
    cols = {c.get("name") for c in inspector.get_columns("equipos")}
    if "reservado_pedido_id" not in cols:
        op.add_column("equipos", sa.Column("reservado_pedido_id", sa.Integer(), nullable=True))
    if "reservado_detalle_pedido_id" not in cols:
        op.add_column(
            "equipos",
            sa.Column("reservado_detalle_pedido_id", sa.Integer(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "equipos" not in tables:
        return
    cols = {c.get("name") for c in inspector.get_columns("equipos")}
    if "reservado_detalle_pedido_id" in cols:
        op.drop_column("equipos", "reservado_detalle_pedido_id")
    if "reservado_pedido_id" in cols:
        op.drop_column("equipos", "reservado_pedido_id")

