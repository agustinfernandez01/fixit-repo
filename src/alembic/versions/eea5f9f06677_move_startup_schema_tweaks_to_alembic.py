"""move startup schema tweaks to alembic

Revision ID: eea5f9f06677
Revises: 
Create Date: 2026-04-21 15:43:58.028141

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'eea5f9f06677'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "equipos" in tables:
        cols_equipos = {c.get("name") for c in inspector.get_columns("equipos")}
        if "foto_url" not in cols_equipos:
            op.add_column("equipos", sa.Column("foto_url", sa.String(length=255), nullable=True))
        if "color" not in cols_equipos:
            op.add_column("equipos", sa.Column("color", sa.String(length=50), nullable=True))

    if "productos" in tables:
        cols_productos = {c.get("name") for c in inspector.get_columns("productos")}
        if "precio_usd" not in cols_productos:
            op.add_column("productos", sa.Column("precio_usd", sa.Numeric(12, 2), nullable=True))

    if "modelos_canje" in tables:
        cols_modelos_canje = {c.get("name") for c in inspector.get_columns("modelos_canje")}
        if "foto_url" not in cols_modelos_canje:
            op.add_column(
                "modelos_canje",
                sa.Column("foto_url", sa.String(length=255), nullable=True),
            )

    if "cotizaciones_canje" in tables:
        cols_cotizaciones = {c.get("name") for c in inspector.get_columns("cotizaciones_canje")}
        if "id_modelo_canje" not in cols_cotizaciones:
            op.add_column(
                "cotizaciones_canje",
                sa.Column("id_modelo_canje", sa.Integer(), nullable=True),
            )

        if "id_modelo" in cols_cotizaciones:
            id_modelo_col = next(
                (
                    c
                    for c in inspector.get_columns("cotizaciones_canje")
                    if c.get("name") == "id_modelo"
                ),
                None,
            )
            if id_modelo_col and not id_modelo_col.get("nullable", False):
                op.alter_column(
                    "cotizaciones_canje",
                    "id_modelo",
                    existing_type=sa.Integer(),
                    nullable=True,
                )

    if "solicitudes_canje" in tables:
        cols_solicitudes = {c.get("name") for c in inspector.get_columns("solicitudes_canje")}
        if "metodo_pago" not in cols_solicitudes:
            op.add_column(
                "solicitudes_canje",
                sa.Column("metodo_pago", sa.String(length=50), nullable=True),
            )
        if "fecha_respuesta" not in cols_solicitudes:
            op.add_column(
                "solicitudes_canje",
                sa.Column("fecha_respuesta", sa.DateTime(), nullable=True),
            )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "solicitudes_canje" in tables:
        cols_solicitudes = {c.get("name") for c in inspector.get_columns("solicitudes_canje")}
        if "fecha_respuesta" in cols_solicitudes:
            op.drop_column("solicitudes_canje", "fecha_respuesta")
        if "metodo_pago" in cols_solicitudes:
            op.drop_column("solicitudes_canje", "metodo_pago")

    if "cotizaciones_canje" in tables:
        cols_cotizaciones = {c.get("name") for c in inspector.get_columns("cotizaciones_canje")}
        if "id_modelo" in cols_cotizaciones:
            op.alter_column(
                "cotizaciones_canje",
                "id_modelo",
                existing_type=sa.Integer(),
                nullable=False,
            )
        if "id_modelo_canje" in cols_cotizaciones:
            op.drop_column("cotizaciones_canje", "id_modelo_canje")

    if "modelos_canje" in tables:
        cols_modelos_canje = {c.get("name") for c in inspector.get_columns("modelos_canje")}
        if "foto_url" in cols_modelos_canje:
            op.drop_column("modelos_canje", "foto_url")

    if "productos" in tables:
        cols_productos = {c.get("name") for c in inspector.get_columns("productos")}
        if "precio_usd" in cols_productos:
            op.drop_column("productos", "precio_usd")

    if "equipos" in tables:
        cols_equipos = {c.get("name") for c in inspector.get_columns("equipos")}
        if "color" in cols_equipos:
            op.drop_column("equipos", "color")
        if "foto_url" in cols_equipos:
            op.drop_column("equipos", "foto_url")
