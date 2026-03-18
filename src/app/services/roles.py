from sqlalchemy.orm import Session
from app.models.roles import Roles
from app.schemas.roles import RolesResponse

def get_roles(db: Session) -> list[RolesResponse]:
    return db.query(Roles).all()

