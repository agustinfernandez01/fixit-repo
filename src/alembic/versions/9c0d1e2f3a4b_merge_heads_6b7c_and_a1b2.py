"""merge alembic heads (6b7c9d0e1f2a + a1b2c3d4e5f6)

Revision ID: 9c0d1e2f3a4b
Revises: 6b7c9d0e1f2a, a1b2c3d4e5f6
Create Date: 2026-05-05 12:58:00.000000

"""

from typing import Sequence, Union


revision: str = "9c0d1e2f3a4b"
down_revision: Union[str, Sequence[str], None] = ("6b7c9d0e1f2a", "a1b2c3d4e5f6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

