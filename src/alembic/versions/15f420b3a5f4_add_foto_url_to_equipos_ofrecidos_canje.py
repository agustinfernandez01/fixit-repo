"""add foto_url to equipos_ofrecidos_canje

Revision ID: 15f420b3a5f4
Revises: eea5f9f06677
Create Date: 2026-04-21 17:33:14.511469

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '15f420b3a5f4'
down_revision: Union[str, Sequence[str], None] = 'eea5f9f06677'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "equipos_ofrecidos_canje" not in tables:
        return

    cols = {c.get("name") for c in inspector.get_columns("equipos_ofrecidos_canje")}
    if "foto_url" not in cols:
        op.add_column(
            "equipos_ofrecidos_canje",
            sa.Column("foto_url", sa.String(length=255), nullable=True),
        )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "equipos_ofrecidos_canje" not in tables:
        return

    cols = {c.get("name") for c in inspector.get_columns("equipos_ofrecidos_canje")}
    if "foto_url" in cols:
        op.drop_column("equipos_ofrecidos_canje", "foto_url")
