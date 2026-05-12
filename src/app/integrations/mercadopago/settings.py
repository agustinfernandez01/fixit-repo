from __future__ import annotations

from dataclasses import dataclass

from app.config import APP_PUBLIC_BASE_URL, MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_PUBLIC_KEY


@dataclass(frozen=True)
class MercadoPagoSettings:
    access_token: str
    public_key: str
    public_base_url: str

    @property
    def notification_url(self) -> str | None:
        if not self.public_base_url:
            return None
        return f"{self.public_base_url.rstrip('/')}/api/v1/mercadopago/webhooks"

    def back_urls(
        self,
        success: str,
        failure: str,
        pending: str,
    ) -> dict[str, str]:
        return {"success": success, "failure": failure, "pending": pending}


def get_mercadopago_settings() -> MercadoPagoSettings:
    return MercadoPagoSettings(
        access_token=MERCADOPAGO_ACCESS_TOKEN,
        public_key=MERCADOPAGO_PUBLIC_KEY,
        public_base_url=APP_PUBLIC_BASE_URL,
    )
