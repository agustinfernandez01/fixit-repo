from app.services.tokens import verificar_refresh_token
from app.models.sesiones_login import SesionesLogin as model_sesiones
from sqlalchemy.orm import Session


def logout(db: Session, refresh_token: str):
    try:
        payload = verificar_refresh_token(refresh_token)
        session_id = int(payload["session_id"])
        id_usuario = payload["id_usuario"]
    except ValueError as e:
        raise ValueError(f"Token inválido: {e}") from e

    sesion = (
        db.query(model_sesiones)
        .filter(
            model_sesiones.id_sesion == session_id,
            model_sesiones.id_usuario == id_usuario,
        )
        .first()
    )

    if not sesion:
        raise ValueError("Sesión no encontrada")

    sesion.revocada = True
    db.commit()

    return {"message": "Logout exitoso"}
