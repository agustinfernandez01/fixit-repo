from app.services.tokens import verificar_refresh_token
from app.models.sesiones_login import SesionesLogin as model_sesiones
from sqlalchemy.orm import Session

def logout(db: Session, refresh_token: str):
    # 1) Validar refresh token
    try:
        payload = verificar_refresh_token(refresh_token)
        session_id = payload["session_id"]
        id_usuario = payload["id_usuario"]
    except ValueError as e:
        raise ValueError(f"Token inválido: {e}")

    # 2) Buscar sesión
    sesion = db.query(model_sesiones).filter(
        model_sesiones.id_sesion == session_id,
        model_sesiones.id_usuario == id_usuario
    ).first()

    if not sesion:
        raise ValueError("Sesión no encontrada")

    # 3) Revocar SOLO esta sesión
    sesion.revocada = True

    db.commit()

    # 4) Respuesta
    return {"message": "Logout exitoso"}