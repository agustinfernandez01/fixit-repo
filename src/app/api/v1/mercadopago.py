"""Rutas HTTP relacionadas con Mercado Pago (webhooks, estado de configuración).

La creación de preferencias se puede exponer aquí o desde el módulo de carrito;
por ahora solo estado y webhooks (lógica de actualización de `Pago` pendiente).
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Request, status

from app.integrations.mercadopago import get_mercadopago_settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/estado")
def mercadopago_estado() -> dict[str, Any]:
    """Flags para el front (sin secretos)."""
    s = get_mercadopago_settings()
    return {
        "mercadopago_configurado": bool(s.access_token),
        "clave_publica_presente": bool(s.public_key),
        "url_notificacion": s.notification_url,
        "base_url_publica_configurada": bool(s.public_base_url),
    }


@router.api_route("/webhooks", methods=["GET", "POST"], status_code=status.HTTP_200_OK)
async def mercadopago_webhooks(request: Request) -> dict[str, str]:
    """
    Punto de entrada para notificaciones IPN / webhooks.
    MP puede usar GET o POST según el tipo; respondemos 200 rápido y dejamos
    la correlación con `Pago` para el siguiente paso.
    """
    q = dict(request.query_params)
    body: Any = None
    try:
        body = await request.json()
    except Exception:
        body = None
    logger.info(
        "mercadopago_webhooks method=%s query=%s body=%s",
        request.method,
        q,
        body,
    )
    if not get_mercadopago_settings().access_token:
        logger.warning(
            "mercadopago_webhooks recibido pero MERCADOPAGO_ACCESS_TOKEN no está configurado; "
            "no se puede consultar el pago hasta configurar el entorno."
        )
    return {"ok": "true"}
