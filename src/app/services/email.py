"""Envío de emails transaccionales vía Resend (https://resend.com).

Aislado del resto de la lógica de auth para poder swappear el proveedor
(SMTP, SendGrid, etc.) sin tocar los servicios que lo consumen.
"""
import logging

import httpx

from app.config import RESEND_API_KEY, RESEND_FROM_EMAIL

logger = logging.getLogger(__name__)

RESEND_ENDPOINT = "https://api.resend.com/emails"


class EmailNoConfigurado(RuntimeError):
    """Se intentó enviar un email sin RESEND_API_KEY configurada."""


def _enviar(destinatario: str, asunto: str, html: str) -> None:
    if not RESEND_API_KEY:
        raise EmailNoConfigurado(
            "RESEND_API_KEY no está configurada; no se puede enviar el email."
        )

    payload = {
        "from": RESEND_FROM_EMAIL,
        "to": [destinatario],
        "subject": asunto,
        "html": html,
    }
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=10.0) as client:
        resp = client.post(RESEND_ENDPOINT, json=payload, headers=headers)
        if resp.status_code >= 400:
            logger.error("Resend rechazó el email (%s): %s", resp.status_code, resp.text)
            resp.raise_for_status()


def enviar_email_reset(destinatario: str, nombre: str, link_reset: str) -> None:
    """Envía el email con el link para restablecer la contraseña."""
    asunto = "Restablecé tu contraseña - Fix It"
    saludo = f"Hola {nombre}," if nombre else "Hola,"
    html = f"""
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
      <p style="font-size: 12px; letter-spacing: 2px; color: #999; text-transform: uppercase; margin-bottom: 4px;">Fix It</p>
      <h1 style="font-size: 22px; margin: 0 0 16px;">Restablecer contraseña</h1>
      <p style="font-size: 14px; color: #444;">{saludo}</p>
      <p style="font-size: 14px; color: #444;">
        Recibimos un pedido para restablecer la contraseña de tu cuenta. Hacé clic en el botón
        para elegir una nueva. Este enlace vence en 30 minutos.
      </p>
      <p style="margin: 28px 0;">
        <a href="{link_reset}"
           style="background: #111; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 999px; font-size: 14px; display: inline-block;">
          Restablecer contraseña
        </a>
      </p>
      <p style="font-size: 12px; color: #999;">
        Si no pediste esto, podés ignorar este correo; tu contraseña no cambiará.
      </p>
      <p style="font-size: 12px; color: #999; word-break: break-all;">
        O copiá este enlace en tu navegador:<br />{link_reset}
      </p>
    </div>
    """
    _enviar(destinatario, asunto, html)
