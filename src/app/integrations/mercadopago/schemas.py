from __future__ import annotations

from decimal import Decimal
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class PreferenceItem(BaseModel):
    """Ítem de preferencia Checkout Pro (subset alineado con la API de MP)."""

    title: str = Field(min_length=1, max_length=256)
    quantity: int = Field(ge=1)
    unit_price: Decimal = Field(ge=0, decimal_places=2)
    currency_id: str = Field(default="ARS", min_length=3, max_length=3)


class PreferenceBackUrls(BaseModel):
    success: str = Field(min_length=1)
    failure: str = Field(min_length=1)
    pending: str = Field(min_length=1)


class PreferenceCreateRequest(BaseModel):
    items: list[PreferenceItem] = Field(min_length=1)
    external_reference: str = Field(min_length=1, max_length=256)
    notification_url: Optional[str] = None
    back_urls: Optional[PreferenceBackUrls] = None
    auto_return: Literal["approved"] | None = None

    def to_api_body(self) -> dict[str, Any]:
        body: dict[str, Any] = {
            "items": [
                {
                    "title": it.title,
                    "quantity": it.quantity,
                    "unit_price": float(it.unit_price),
                    "currency_id": it.currency_id,
                }
                for it in self.items
            ],
            "external_reference": self.external_reference,
        }
        if self.notification_url:
            body["notification_url"] = self.notification_url
        if self.back_urls:
            body["back_urls"] = self.back_urls.model_dump()
        if self.auto_return:
            body["auto_return"] = self.auto_return
        return body


class PreferenceCreateResponse(BaseModel):
    """Respuesta mínima tras crear preferencia (init_point para redirigir)."""

    model_config = ConfigDict(extra="allow")

    id: str | None = None
    init_point: str | None = None
    sandbox_init_point: str | None = None


class PaymentSummary(BaseModel):
    """Subset de GET /v1/payments/{id} para mapear a `Pago` y reglas de negocio."""

    model_config = ConfigDict(extra="allow")

    id: int | None = None
    status: str | None = None
    status_detail: str | None = None
    external_reference: str | None = None
    transaction_amount: float | None = None
    currency_id: str | None = None
