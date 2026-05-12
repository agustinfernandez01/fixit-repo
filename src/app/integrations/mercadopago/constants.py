"""Constantes de la API REST de Mercado Pago (misma URL para sandbox y prod; el token define el entorno)."""

API_BASE_URL = "https://api.mercadopago.com"
CHECKOUT_PREFERENCES_PATH = "/checkout/preferences"
PAYMENTS_V1_PATH_TEMPLATE = "/v1/payments/{payment_id}"
