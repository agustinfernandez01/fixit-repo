"""equipo estado previo al reservar venta

Revision ID: c8a1b2d3e4f5
Revises: 15f420b3a5f4
Create Date: 2026-04-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8a1b2d3e4f5"
down_revision: Union[str, Sequence[str], None] = "15f420b3a5f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "equipos" not in tables:
        return
    cols = {c.get("name") for c in inspector.get_columns("equipos")}
    if "estado_comercial_previo_reserva" not in cols:
        op.add_column(
            "equipos",
            sa.Column("estado_comercial_previo_reserva", sa.String(length=50), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "equipos" not in tables:
        return
    cols = {c.get("name") for c in inspector.get_columns("equipos")}
    if "estado_comercial_previo_reserva" in cols:
        op.drop_column("equipos", "estado_comercial_previo_reserva")
