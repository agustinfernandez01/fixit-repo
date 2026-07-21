# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Fix It is an ecommerce + inventory/stock system for a cellphone (Apple-focused) retailer. Two apps in one repo:

- `client/` — Frontend: React 19 + Vite + TypeScript + Tailwind v4, React Router v7, TanStack Query.
- `src/` — Backend: Python + FastAPI + SQLAlchemy 2.0, Alembic migrations. All API under `/api/v1`.

Code, comments, and domain terms are in **Spanish** — match that when writing new code (e.g. `equipos`, `canje`, `reparaciones`, `usados`, `inventario`).

## Commands

Run from the repo root (Windows / PowerShell):

- `npm run dev` (alias `npm run levantar`) — runs backend + frontend concurrently; frontend waits for the API on port 8000 first.
- `npm run back` — backend only: `cd src && .\venv\Scripts\python.exe -m uvicorn app.main:app --reload`. Expects a venv at `src/venv`.
- `npm run front` — frontend only (Vite on port 5173, strict port).

Frontend (`cd client`):

- `npm run dev` — dev server (port 5173).
- `npm run build` — `tsc -b && vite build` (typecheck is part of the build).
- `npm run lint` — ESLint.
- `npm test` — Vitest (single run). `npm run test:watch` for watch mode. Run one file: `npx vitest run src/pages/client/CarritoPage.test.tsx`. Tests use jsdom + Testing Library; setup in `client/src/test/setup.ts`. Frontend tests are the only automated tests in the repo (no backend test suite).

Backend (`cd src`, with the venv active):

- `uvicorn app.main:app --reload` — API on http://127.0.0.1:8000, Swagger docs at `/docs`.
- `pip install -r app/requirements.txt` — install deps.
- `alembic upgrade head` — apply DB migrations. `alembic revision --autogenerate -m "msg"` to create one.

Docker: `docker-compose up` brings up Postgres 16 + backend + frontend. `env_file: .env` for the backend.

## Architecture

### Backend (`src/app/`)

Layered, one module per domain. The domains are: `auth`, `productos`, `inventario` (used-equipment stock + catalog models), `accesorios`, `marketplace` (used-phone listings), `reparaciones` (repairs), `canje` (trade-in), `carrito` (cart), `mercadopago`.

- `api/v1/<domain>.py` — routers; registered in `api/v1/__init__.py` and mounted at `/api/v1` in `main.py`.
- `services/<domain>.py` — business logic. Routers should stay thin and call into services.
- `models/<domain>.py` — SQLAlchemy ORM. **Every model must be imported by `models/__init__.py`** so it registers on `Base.metadata` (main.py imports `app.models` for this).
- `schemas/<domain>.py` — Pydantic request/response models.
- `deps/` — FastAPI dependencies. `deps/auth.py` is the authz layer.
- `integrations/mercadopago/` — Mercado Pago Checkout Pro client. `services/storage.py` — Cloudflare R2 (S3-compatible) image uploads via boto3.
- `config.py` — central env/settings loader (loads `src/.env` then `src/app/.env`).

Note: there are duplicate `_init_.py` (single-underscore, dead) files alongside the real `__init__.py` in `models/` and `services/` — ignore the single-underscore ones.

### Database config (`config.py`)

`DATABASE_URL` is resolved by priority: explicit `DATABASE_URL` env → `PG_*` parts (Postgres) → **MySQL local fallback** (`DB_*`, default `mysql+pymysql://root:1452@127.0.0.1:3306/fixitdb`). Postgres URLs are normalized to the `psycopg2` driver and get `sslmode=require` for `render.com` hosts. So the same code targets Postgres (Docker/Render) or a local MySQL depending on env.

### Schema management

The schema is meant to be managed **exclusively via Alembic** — there is no `create_all()`. Caveat: `main.py`'s startup still runs two idempotent runtime column-patch helpers (`_ensure_opcion_foto_url_column`, `_ensure_publicaciones_columns`) that add columns if missing. Prefer a real Alembic migration for new schema; only touch those helpers if extending that legacy path. Rotating `SECRET_KEY` invalidates all tokens — see `docs/OPERACIONES_SEGURIDAD.md`.

### Auth (JWT, HS256)

- `services/tokens.py` — access token (15 min) carries `sub`, `email`, `nombre`, `apellido`, `rol`, `type: "access"`; refresh token (7 days) carries `sub`, `session_id`, `type: "refresh"`. Refresh tokens are stored hashed (bcrypt over a sha256 pre-hash, since bcrypt caps at 72 bytes).
- `deps/auth.py` — `require_admin_user_id` enforces the admin role from the `rol` claim (falls back to a DB lookup if the claim is missing). Set `DISABLE_ADMIN_AUTH=1` to bypass admin auth in local dev.

### Frontend (`client/src/`)

- Routing in `App.tsx`: public/client area under `/` (`ClientLayout`), admin under `/admin` (`AdminLayout`), with nested `inventario/*` and `marketplace/*` sections. Client pages in `pages/client/`, admin/back-office in `pages/admin/`, `pages/inventario/`, `pages/marketplace/`.
- `services/<domain>Api.ts` — one API module per backend domain; `services/api.ts` is the shared fetch layer.
- `services/api.ts` — `fetchJson` is the core client. It **auto-refreshes on 401** (calls `/api/v1/auth/refresh`, retries once), parses FastAPI 422 validation errors, and uses `apiUrl`/`mediaUrl` (prefix `VITE_API_BASE` in prod; empty in dev so Vite proxies). Prefer `fetchJson` over raw `fetch`.
- `lib/auth.ts` — token storage in `localStorage` (`fixit_access_token` / `fixit_refresh_token`), JWT decode helpers (`getCurrentUserRole`, `getCurrentUserProfile`, `getCurrentUserId`), and `fixit:auth-updated` / `fixit:auth-refresh-state` window events for cross-component auth state.
- Server state via TanStack Query (`hooks/queries.ts`, provider in `main.tsx`: 30 s staleTime, retry 1, no refetch-on-focus). `types/` holds shared TS types per domain. `data/appleCatalog.ts` is the static Apple product catalog.
- In dev, `vite.config.ts` proxies `/api`, `/uploads`, and several legacy paths to the backend (`BACKEND_URL` env, default `http://127.0.0.1:8000`).

### Domain notes

- Home dedup logic (one representative card per model) is documented in `docs/HOME_DEDUPLICACION.md` and lives in `pages/client/HomeView.tsx` — keep them in sync.
- Checkout flows through WhatsApp (`WHATSAPP_CHECKOUT_PHONE`) and/or Mercado Pago.
- Product images: legacy files served from `/uploads` (static mount); new uploads go to Cloudflare R2 (`R2_*` env vars).

## Reglas de rendimiento

Reglas que salieron de una auditoría concreta de este código, no de teoría general. Romperlas
ya causó problemas medibles en producción, así que respetalas al escribir código nuevo.

- **Toda FK nueva lleva su índice.** Postgres —a diferencia de MySQL— **no** crea índices
  automáticos sobre las foreign keys. Sin índice, cada filtro por esa columna es un scan
  secuencial. Poné `index=True` en la columna del modelo y creá el índice en la migración
  (`alembic/versions/c1d2e3f4a5b6_indices_de_rendimiento.py` es el ejemplo a seguir: usa
  `CREATE INDEX CONCURRENTLY` dentro de `autocommit_block()` para no bloquear la tabla).
- **Nunca I/O bloqueante dentro de `async def`.** boto3 (`services/storage.py`), `db.query()`
  y cualquier cliente HTTP sincrónico congelan el event loop —y con él, el servidor entero
  para todos los usuarios— mientras corren. Si el endpoint hace I/O sincrónico, definilo con
  `def`: FastAPI lo deriva solo al threadpool. Los endpoints de subida de fotos usan
  `foto.file.read()`, no `await foto.read()`, justamente por esto.
- **Todo endpoint de listado nace paginado**, con `skip`/`limit` que lleguen al SQL. Paginar
  en Python después de un `.all()` no sirve: el costo ya se pagó.
- **Nunca consultes dentro de un loop.** Si necesitás datos relacionados, usá `joinedload`
  para relaciones many-to-one y `selectinload` para colecciones (dos `joinedload` encadenados
  sobre la misma one-to-many producen un producto cartesiano). Para datos que no son
  relaciones, resolvelos en batch con un `IN (...)`;
  `services/carrito.py:disponibilidad_por_productos` es el patrón de referencia.
- **En el frontend, el estado del servidor va por TanStack Query** (`hooks/queries.ts`), no
  por `useEffect` + `useState`. El fetch manual no cachea ni deduplica: cada navegación
  vuelve a pegarle al backend. Registrá la clave nueva en `qk` para que la invalidación
  después de una mutación sea consistente.
- **Rutas nuevas van con `React.lazy`** en `App.tsx`, salvo que sean parte de la primera
  pantalla.

### Cómo medir

- `app/observabilidad.py` mide cada request: devuelve los headers `X-Response-Time` y
  `X-DB-Query-Count`, y loguea `método · ruta · ms · nº de queries` en el logger `fixit.perf`
  (sube a WARNING pasando `PERF_UMBRAL_QUERIES`, default 25, o `PERF_UMBRAL_MS`, default 1000).
  Si un endpoint nuevo aparece con 200 queries, se ve el día que se escribe.
- `contar_queries()` es el context manager para tests. `src/tests/test_rendimiento_consultas.py`
  tiene tests de regresión que fallan si un flujo crítico vuelve a escalar con la cantidad de
  filas. Al tocar carrito o el panel de pedidos, corrélos: `cd src && python -m pytest tests -q`.

### Nota sobre el hosting

El plan gratuito de Render duerme la instancia tras 15 minutos de inactividad y tarda ~50 s en
despertar. En la lentitud percibida eso pesa más que cualquier optimización de código, y ninguna
de estas reglas lo corrige: son problemas independientes. No confundas un cold start con una
regresión de rendimiento.
