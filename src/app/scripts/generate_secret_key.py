"""Genera una SECRET_KEY segura para JWT.

Uso (desde `src`):

    python -m app.scripts.generate_secret_key
"""

from __future__ import annotations

import secrets


def main() -> None:
    # 48 bytes -> string URL-safe suficientemente larga para HS256.
    key = secrets.token_urlsafe(48)
    print("SECRET_KEY=" + key)


if __name__ == "__main__":
    main()
