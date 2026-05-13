"""Servicio de almacenamiento en Cloudflare R2 (compatible con S3)."""
import boto3
from botocore.exceptions import ClientError

from app.config import (
    R2_ENDPOINT_URL,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_PUBLIC_URL,
)

_client = None


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


def upload_file(content: bytes, key: str, content_type: str) -> str:
    """Sube bytes a R2 con la key dada y devuelve la URL pública."""
    _get_client().put_object(
        Bucket=R2_BUCKET_NAME,
        Key=key,
        Body=content,
        ContentType=content_type,
    )
    return f"{R2_PUBLIC_URL}/{key}"


def delete_file(key: str) -> None:
    """Elimina un objeto de R2. No lanza excepción si no existe."""
    try:
        _get_client().delete_object(Bucket=R2_BUCKET_NAME, Key=key)
    except ClientError:
        pass


def list_files(prefix: str) -> list[str]:
    """Lista objetos en R2 con el prefijo dado y devuelve sus URLs públicas."""
    response = _get_client().list_objects_v2(Bucket=R2_BUCKET_NAME, Prefix=prefix)
    return [
        f"{R2_PUBLIC_URL}/{obj['Key']}"
        for obj in response.get("Contents", [])
    ]


def key_from_url(url: str) -> str:
    """Extrae la key de R2 a partir de su URL pública."""
    return url.removeprefix(f"{R2_PUBLIC_URL}/")
