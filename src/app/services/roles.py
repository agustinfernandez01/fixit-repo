from sqlalchemy.orm import Session

from app.models.roles import Rol
from app.schemas.roles import RolesResponse


def get_roles(db: Session) -> list[RolesResponse]:
    return db.query(Rol).all()
