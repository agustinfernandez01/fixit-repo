from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import case
from sqlalchemy.orm import Session, joinedload

from app.config import UPLOAD_DIR
from app.models.canje import EquipoOfrecidoCanje, SolicitudCanje
from app.models.equipos import Equipo
from app.models.productos import Productos


def _formatear_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))


def _listar_fotos_equipo_ofrecido(id_equipo_ofrecido: int) -> list[str]:
    rel_dir = Path("canje_equipos") / str(id_equipo_ofrecido)
    abs_dir = UPLOAD_DIR / rel_dir
    if not abs_dir.exists():
        return []

    fotos: list[str] = []
    for p in sorted(abs_dir.iterdir()):
        if not p.is_file():
            continue
        if p.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        fotos.append(f"/uploads/{rel_dir.as_posix()}/{p.name}")
    return fotos


def _aplicar_descuento_stock(db: Session, id_producto: int) -> None:
    producto = (
        db.query(Productos)
        .filter(Productos.id == id_producto, Productos.activo.is_(True))
        .first()
    )
    if not producto:
        raise ValueError("El producto ya no está disponible para completar el canje")

    equipo = db.query(Equipo).filter(Equipo.id_producto == id_producto).first()
    if equipo:
        equipo.activo = False
        equipo.estado_comercial = "vendido"

    producto.activo = False


def listar_solicitudes_admin(db: Session) -> list[dict[str, Any]]:
    solicitudes = (
        db.query(SolicitudCanje)
        .options(
            joinedload(SolicitudCanje.usuario),
            joinedload(SolicitudCanje.equipo_ofrecido),
            joinedload(SolicitudCanje.producto_interes),
        )
        .order_by(
            case((SolicitudCanje.fecha_solicitud.is_(None), 1), else_=0),
            SolicitudCanje.fecha_solicitud.desc(),
            SolicitudCanje.id_solicitud_canje.desc(),
        )
        .all()
    )

    data: list[dict[str, Any]] = []
    for solicitud in solicitudes:
        usuario = solicitud.usuario
        equipo = solicitud.equipo_ofrecido
        producto = solicitud.producto_interes
        data.append(
            {
                "id_solicitud_canje": solicitud.id_solicitud_canje,
                "id_usuario": solicitud.id_usuario,
                "cliente_nombre": f"{usuario.nombre} {usuario.apellido}".strip() if usuario else None,
                "cliente_email": usuario.email if usuario else None,
                "cliente_telefono": usuario.telefono if usuario else None,
                "id_equipo_ofrecido": solicitud.id_equipo_ofrecido,
                "equipo_modelo": equipo.modelo if equipo else None,
                "equipo_capacidad_gb": equipo.capacidad_gb if equipo else None,
                "equipo_color": equipo.color if equipo else None,
                "equipo_bateria_porcentaje": equipo.bateria_porcentaje if equipo else None,
                "equipo_estado_estetico": equipo.estado_estetico if equipo else None,
                "equipo_estado_funcional": equipo.estado_funcional if equipo else None,
                "equipo_foto_url": (equipo.foto_url if equipo else None),
                "equipo_fotos_urls": (
                    _listar_fotos_equipo_ofrecido(solicitud.id_equipo_ofrecido)
                    if equipo
                    else []
                ),
                "id_producto_interes": solicitud.id_producto_interes,
                "producto_interes_nombre": producto.nombre if producto else None,
                "producto_interes_precio": _formatear_decimal(producto.precio) if producto else None,
                "producto_interes_activo": producto.activo if producto else None,
                "valor_estimado": _formatear_decimal(solicitud.valor_estimado),
                "diferencia_a_pagar": _formatear_decimal(solicitud.diferencia_a_pagar),
                "metodo_pago": (solicitud.metodo_pago or "a definir"),
                "estado": solicitud.estado,
                "fecha_solicitud": solicitud.fecha_solicitud,
                "fecha_respuesta": solicitud.fecha_respuesta,
                "observaciones": equipo.observaciones if equipo else None,
            }
        )

    return data


def completar_solicitud_canje(
    db: Session,
    id_solicitud_canje: int,
    metodo_pago: str | None = None,
) -> SolicitudCanje:
    solicitud = (
        db.query(SolicitudCanje)
        .options(joinedload(SolicitudCanje.producto_interes))
        .filter(SolicitudCanje.id_solicitud_canje == id_solicitud_canje)
        .first()
    )
    if not solicitud:
        raise ValueError("Solicitud de canje no encontrada")

    estado_actual = (solicitud.estado or "").strip().lower()
    if estado_actual in {"completado", "rechazado"}:
        raise ValueError("La solicitud ya fue procesada")

    if not solicitud.producto_interes:
        raise ValueError("La solicitud no tiene un producto de interés asociado")

    _aplicar_descuento_stock(db, solicitud.id_producto_interes)

    solicitud.estado = "completado"
    solicitud.fecha_respuesta = datetime.now(timezone.utc)
    if metodo_pago is not None and metodo_pago.strip():
        solicitud.metodo_pago = metodo_pago.strip()
    elif not solicitud.metodo_pago:
        solicitud.metodo_pago = "a definir"

    db.commit()
    db.refresh(solicitud)
    return solicitud


def rechazar_solicitud_canje(db: Session, id_solicitud_canje: int, metodo_pago: str | None = None) -> SolicitudCanje:
    solicitud = db.query(SolicitudCanje).filter(SolicitudCanje.id_solicitud_canje == id_solicitud_canje).first()
    if not solicitud:
        raise ValueError("Solicitud de canje no encontrada")

    estado_actual = (solicitud.estado or "").strip().lower()
    if estado_actual in {"completado", "rechazado"}:
        raise ValueError("La solicitud ya fue procesada")

    solicitud.estado = "rechazado"
    solicitud.fecha_respuesta = datetime.now(timezone.utc)
    if metodo_pago is not None and metodo_pago.strip():
        solicitud.metodo_pago = metodo_pago.strip()
    elif not solicitud.metodo_pago:
        solicitud.metodo_pago = "a definir"

    db.commit()
    db.refresh(solicitud)
    return solicitud