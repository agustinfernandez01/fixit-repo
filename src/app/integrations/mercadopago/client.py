from __future__ import annotations

import logging
from typing import Any

import httpx

from app.integrations.mercadopago.constants import (
    API_BASE_URL,
    CHECKOUT_PREFERENCES_PATH,
    PAYMENTS_V1_PATH_TEMPLATE,
)
from app.integrations.mercadopago.schemas import PreferenceCreateRequest
from app.integrations.mercadopago.settings import MercadoPagoSettings

logger = logging.getLogger(__name__)


class MercadoPagoAPIError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Mercado Pago API {status_code}: {detail}")


class MercadoPagoClient:
    """Cliente HTTP síncrono hacia la API REST de Mercado Pago."""

    def __init__(self, settings: MercadoPagoSettings) -> None:
        self._http = httpx.Client(
            base_url=API_BASE_URL,
            headers={
                "Authorization": f"Bearer {settings.access_token}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    def close(self) -> None:
        self._http.close()

    def create_preference(self, request: PreferenceCreateRequest) -> dict[str, Any]:
        payload = request.to_api_body()
        resp = self._http.post(CHECKOUT_PREFERENCES_PATH, json=payload)
        if resp.status_code >= 400:
            text = (resp.text or "")[:500]
            logger.warning("create_preference falló: %s %s", resp.status_code, text)
            raise MercadoPagoAPIError(resp.status_code, text or resp.reason_phrase)
        data = resp.json()
        if not isinstance(data, dict):
            raise MercadoPagoAPIError(resp.status_code, "respuesta no es objeto JSON")
        return data

    def get_payment(self, payment_id: int) -> dict[str, Any]:
        path = PAYMENTS_V1_PATH_TEMPLATE.format(payment_id=payment_id)
        resp = self._http.get(path)
        if resp.status_code >= 400:
            text = (resp.text or "")[:500]
            logger.warning("get_payment falló: %s %s", resp.status_code, text)
            raise MercadoPagoAPIError(resp.status_code, text or resp.reason_phrase)
        data = resp.json()
        if not isinstance(data, dict):
            raise MercadoPagoAPIError(resp.status_code, "respuesta no es objeto JSON")
        return data
