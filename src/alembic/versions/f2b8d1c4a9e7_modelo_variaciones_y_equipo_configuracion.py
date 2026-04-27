"""modelo variaciones y equipo configuracion

Revision ID: f2b8d1c4a9e7
Revises: d1e2f3a4b5c6
Create Date: 2026-04-27 13:08:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f2b8d1c4a9e7"
down_revision = "d1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "modelo_atributo",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_modelo", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("tipo_ui", sa.String(length=20), nullable=False, server_default="chip"),
        sa.Column("requerido", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(["id_modelo"], ["modelos_equipo.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id_modelo", "code", name="uq_modelo_atributo_modelo_code"),
    )
    op.create_table(
        "modelo_atributo_opcion",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_atributo", sa.Integer(), nullable=False),
        sa.Column("valor", sa.String(length=100), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("color_hex", sa.String(length=20), nullable=True),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(["id_atributo"], ["modelo_atributo.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id_atributo", "valor", name="uq_modelo_atributo_opcion_valor"),
    )
    op.create_table(
        "equipo_configuracion",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_equipo", sa.Integer(), nullable=False),
        sa.Column("id_atributo", sa.Integer(), nullable=False),
        sa.Column("id_opcion", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["id_atributo"], ["modelo_atributo.id"]),
        sa.ForeignKeyConstraint(["id_equipo"], ["equipos.id"]),
        sa.ForeignKeyConstraint(["id_opcion"], ["modelo_atributo_opcion.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id_equipo", "id_atributo", name="uq_equipo_configuracion_equipo_atributo"),
    )


def downgrade() -> None:
    op.drop_table("equipo_configuracion")
    op.drop_table("modelo_atributo_opcion")
    op.drop_table("modelo_atributo")
