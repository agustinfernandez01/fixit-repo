"""Dependencias FastAPI para operar con Mercado Pago."""

from collections.abc import Generator

from fastapi import HTTPException, status

from app.integrations.mercadopago import MercadoPagoClient, get_mercadopago_settings


def get_mercado_pago_client() -> Generator[MercadoPagoClient, None, None]:
    settings = get_mercadopago_settings()
    if not settings.access_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Mercado Pago no configurado (falta MERCADOPAGO_ACCESS_TOKEN).",
        )
    client = MercadoPagoClient(settings)
    try:
        yield client
    finally:
        client.close()
