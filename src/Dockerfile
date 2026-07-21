# ── Imagen base ──────────────────────────────────────────────────────────────
# Usamos Python 3.11 en su versión "slim" (sin herramientas extra, más liviana)
FROM python:3.11-slim

# ── Directorio de trabajo dentro del contenedor ───────────────────────────────
# Todo lo que hagamos a partir de acá ocurre dentro de /code
WORKDIR /code

# ── Dependencias ──────────────────────────────────────────────────────────────
# Copiamos SOLO el requirements.txt primero.
# Docker cachea cada paso — si el código cambia pero no las deps, no reinstala.
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Código fuente ─────────────────────────────────────────────────────────────
# Ahora sí copiamos todo el código de la app
COPY app/ ./app/

# ── Migraciones ───────────────────────────────────────────────────────────────
# Copiamos alembic para poder correr migraciones dentro del contenedor
COPY alembic/ ./alembic/
COPY alembic.ini .

# ── Puerto ────────────────────────────────────────────────────────────────────
# En local es 8000; en Render el puerto lo inyecta la plataforma vía $PORT.
EXPOSE 8000

# ── Comando de arranque ───────────────────────────────────────────────────────
# Aplica migraciones antes de levantar la API: sin esto el esquema queda desfasado
# (ya no hay parches runtime `_ensure_*` que lo tapen).
# Nota: corre en cada arranque del contenedor. Es idempotente y hoy Render corre una
# sola instancia; si algún día hay varias, mové el `alembic upgrade` a un release job.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]