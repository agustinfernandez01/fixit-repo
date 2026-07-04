"""password reset tokens

Revision ID: a7f3c1d9e0b2
Revises: b3c4d5e6f7a8
Create Date: 2026-07-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7f3c1d9e0b2"
down_revision: Union[str, Sequence[str], None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "password_reset_tokens" in tables:
        return
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("id_usuario", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("token_hash", sa.String(length=512), nullable=False),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
        sa.Column("fecha_expiracion", sa.DateTime(), nullable=False),
        sa.Column("usado", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        "ix_password_reset_tokens_id_usuario",
        "password_reset_tokens",
        ["id_usuario"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "password_reset_tokens" not in tables:
        return
    op.drop_index(
        "ix_password_reset_tokens_id_usuario",
        table_name="password_reset_tokens",
    )
    op.drop_table("password_reset_tokens")
