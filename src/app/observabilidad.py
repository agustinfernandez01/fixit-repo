"""
Instrumentación de rendimiento: tiempo de respuesta y cantidad de queries por request.

No es instrumentación descartable: queda en producción para que un endpoint que
empieza a hacer N+1 se vuelva visible el día que se escribe (ver CLAUDE.md,
sección "Reglas de rendimiento").

Uso:
- `instalar_contador_de_queries(engine)` engancha el listener de SQLAlchemy.
- `TimingMiddleware` agrega el header `X-Response-Time` y loguea
  `método · ruta · ms · nº de queries`.
- `contar_queries()` es un context manager para tests de regresión.
"""
from __future__ import annotations

import logging
import os
import time
from contextlib import contextmanager
from contextvars import ContextVar

from sqlalchemy import event
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("fixit.perf")

# Contador por request (o por bloque `contar_queries()`), aislado por contexto async.
_queries_ctx: ContextVar[list[int] | None] = ContextVar("fixit_queries", default=None)

# Umbral a partir del cual el log sube a WARNING: sirve de alarma temprana de N+1.
UMBRAL_QUERIES_WARNING = int(os.getenv("PERF_UMBRAL_QUERIES", "25"))
UMBRAL_MS_WARNING = int(os.getenv("PERF_UMBRAL_MS", "1000"))


def instalar_contador_de_queries(engine) -> None:
    """Engancha el contador al engine. Idempotente."""
    if getattr(engine, "_fixit_contador_instalado", False):
        return

    @event.listens_for(engine, "before_cursor_execute")
    def _contar(conn, cursor, statement, parameters, context, executemany):  # noqa: ANN001
        contador = _queries_ctx.get()
        if contador is not None:
            contador[0] += 1

    engine._fixit_contador_instalado = True


@contextmanager
def contar_queries():
    """
    Cuenta las queries emitidas dentro del bloque.

        with contar_queries() as n:
            ...
        assert n() < 6
    """
    contador = [0]
    token = _queries_ctx.set(contador)
    try:
        yield lambda: contador[0]
    finally:
        _queries_ctx.reset(token)


class TimingMiddleware(BaseHTTPMiddleware):
    """Mide duración y queries de cada request; expone `X-Response-Time` y loguea."""

    async def dispatch(self, request: Request, call_next):
        contador = [0]
        token = _queries_ctx.set(contador)
        inicio = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            _queries_ctx.reset(token)

        ms = (time.perf_counter() - inicio) * 1000
        n_queries = contador[0]
        response.headers["X-Response-Time"] = f"{ms:.1f}ms"
        response.headers["X-DB-Query-Count"] = str(n_queries)

        nivel = (
            logging.WARNING
            if n_queries >= UMBRAL_QUERIES_WARNING or ms >= UMBRAL_MS_WARNING
            else logging.INFO
        )
        logger.log(
            nivel,
            "%s %s · %.1f ms · %d queries",
            request.method,
            request.url.path,
            ms,
            n_queries,
        )
        return response
