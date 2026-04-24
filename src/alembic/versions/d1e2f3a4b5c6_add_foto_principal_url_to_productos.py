"""add foto_principal_url to productos

Revision ID: d1e2f3a4b5c6
Revises: c8a1b2d3e4f5
Create Date: 2026-04-24 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, Sequence[str], None] = "c8a1b2d3e4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "productos" not in tables:
        return
    cols = {c.get("name") for c in inspector.get_columns("productos")}
    if "foto_principal_url" not in cols:
        op.add_column(
            "productos",
            sa.Column("foto_principal_url", sa.String(length=255), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "productos" not in tables:
        return
    cols = {c.get("name") for c in inspector.get_columns("productos")}
    if "foto_principal_url" in cols:
        op.drop_column("productos", "foto_principal_url")
