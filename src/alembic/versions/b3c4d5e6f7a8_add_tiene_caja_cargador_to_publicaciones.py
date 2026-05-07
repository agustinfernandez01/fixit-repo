"""add tiene_caja y tiene_cargador to publicaciones

Revision ID: b3c4d5e6f7a8
Revises: 9c0d1e2f3a4b
Create Date: 2026-05-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, Sequence[str], None] = '9c0d1e2f3a4b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c.get("name") for c in inspector.get_columns("publicaciones")}
    if "tiene_caja" not in cols:
        op.add_column(
            "publicaciones",
            sa.Column("tiene_caja", sa.Boolean(), nullable=True, server_default=sa.false()),
        )
    if "tiene_cargador" not in cols:
        op.add_column(
            "publicaciones",
            sa.Column("tiene_cargador", sa.Boolean(), nullable=True, server_default=sa.false()),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c.get("name") for c in inspector.get_columns("publicaciones")}
    if "tiene_cargador" in cols:
        op.drop_column("publicaciones", "tiene_cargador")
    if "tiene_caja" in cols:
        op.drop_column("publicaciones", "tiene_caja")
