from app.models.sesiones_login import SesionesLogin
from app.services.tokens import verificar_refresh_token
from sqlalchemy.orm import Session


def logout(db: Session, refresh_token: str):
    try:
        payload = verificar_refresh_token(refresh_token)
        session_id = payload["session_id"]
        id_usuario = payload["id_usuario"]
    except ValueError as e:
        raise ValueError(f"Token inválido: {e}") from e

    sesion = (
        db.query(SesionesLogin)
        .filter(
            SesionesLogin.id_sesion == session_id,
            SesionesLogin.id_usuario == id_usuario,
        )
        .first()
    )

    if not sesion:
        raise ValueError("Sesión no encontrada")

    sesion.revocada = True
    db.commit()

    return {"message": "Logout exitoso"}
