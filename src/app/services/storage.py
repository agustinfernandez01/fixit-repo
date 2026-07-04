"""Servicio de almacenamiento de imágenes.

Usa Cloudflare R2 (compatible con S3) cuando está configurado. Si no lo está
(típico en desarrollo local sin credenciales), cae a guardar en el directorio
local `uploads/`, que `main.py` sirve estáticamente en `/uploads`. Así el alta
de fotos (marketplace, canje, etc.) funciona sin depender de R2.
"""
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

from app.config import (
    R2_ENDPOINT_URL,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_PUBLIC_URL,
    UPLOAD_DIR,
)

_client = None
_LOCAL_PREFIX = "/uploads"


def _r2_configured() -> bool:
    """R2 está listo para usarse si hay endpoint y bucket definidos."""
    return bool(R2_ENDPOINT_URL and R2_BUCKET_NAME)


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=R2_ENDPOINT_URL,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            region_name="auto",
        )
    return _client


# ── Fallback local (disco) ────────────────────────────────────────────────────
def _local_path(key: str) -> Path:
    # key viene como "publicaciones/123/abc.jpg"; se resuelve dentro de UPLOAD_DIR.
    return UPLOAD_DIR / key


def _upload_local(content: bytes, key: str) -> str:
    dest = _local_path(key)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    return f"{_LOCAL_PREFIX}/{key}"


def _delete_local(key: str) -> None:
    try:
        _local_path(key).unlink(missing_ok=True)
    except OSError:
        pass


def _list_local(prefix: str) -> list[str]:
    base = UPLOAD_DIR / prefix
    if not base.exists():
        return []
    urls: list[str] = []
    for p in sorted(base.rglob("*")):
        if p.is_file():
            rel = p.relative_to(UPLOAD_DIR).as_posix()
            urls.append(f"{_LOCAL_PREFIX}/{rel}")
    return urls


# ── API pública ───────────────────────────────────────────────────────────────
def upload_file(content: bytes, key: str, content_type: str) -> str:
    """Sube bytes con la key dada y devuelve la URL pública (R2 o /uploads local)."""
    if not _r2_configured():
        return _upload_local(content, key)
    _get_client().put_object(
        Bucket=R2_BUCKET_NAME,
        Key=key,
        Body=content,
        ContentType=content_type,
    )
    return f"{R2_PUBLIC_URL}/{key}"


def delete_file(key: str) -> None:
    """Elimina un objeto. No lanza excepción si no existe."""
    if not _r2_configured():
        _delete_local(key)
        return
    try:
        _get_client().delete_object(Bucket=R2_BUCKET_NAME, Key=key)
    except ClientError:
        pass


def list_files(prefix: str) -> list[str]:
    """Lista objetos con el prefijo dado y devuelve sus URLs públicas."""
    if not _r2_configured():
        return _list_local(prefix)
    response = _get_client().list_objects_v2(Bucket=R2_BUCKET_NAME, Prefix=prefix)
    return [
        f"{R2_PUBLIC_URL}/{obj['Key']}"
        for obj in response.get("Contents", [])
    ]


def key_from_url(url: str) -> str:
    """Extrae la key a partir de la URL pública (R2 o local)."""
    if url.startswith(f"{_LOCAL_PREFIX}/"):
        return url.removeprefix(f"{_LOCAL_PREFIX}/")
    return url.removeprefix(f"{R2_PUBLIC_URL}/")
