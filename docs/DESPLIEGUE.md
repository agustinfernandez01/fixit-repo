# Despliegue — Render (DB + backend) y Vercel (frontend)

## 0. Antes de empezar

**El `SECRET_KEY` que está en `.env.local` es público**: ese archivo está commiteado en el
repo. No lo reutilices en producción. Generá uno nuevo:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Rotar `SECRET_KEY` invalida todos los tokens emitidos (ver `docs/OPERACIONES_SEGURIDAD.md`).

---

## 1. Base de datos (Render Postgres)

1. Render → **New → Postgres**. Plan free, misma región que vayas a usar para el backend.
2. Copiá la **Internal Database URL** (no la externa: la interna no sale a internet y es más
   rápida).

`app/config.py` normaliza sola la URL: cambia el driver a `psycopg2` y agrega
`sslmode=require` para cualquier host remoto.

> El plan free de Postgres en Render **expira a los 90 días**. Anotate la fecha.

---

## 2. Backend (Render Web Service)

**New → Web Service** → conectá el repo → runtime **Docker**:

| Campo | Valor |
|---|---|
| Root Directory | `src` |
| Dockerfile Path | `./Dockerfile` |
| Health Check Path | `/` |

El `CMD` del Dockerfile corre `alembic upgrade head` antes de levantar uvicorn, así que las
migraciones (incluidos los índices de rendimiento) se aplican solas en cada deploy.

### Variables de entorno

Obligatorias:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Internal Database URL del paso 1 |
| `SECRET_KEY` | La que generaste en el paso 0 |
| `ALLOWED_ORIGINS` | El dominio de Vercel, ej. `https://fixit.vercel.app` |

> `ALLOWED_ORIGINS` tiene default `"*"`, que además **deshabilita las credenciales**
> (wildcard + `allow_credentials=True` es inválido en HTTP). Definila siempre en producción.

Según qué features uses:

| Variable | Para qué |
|---|---|
| `APP_PUBLIC_BASE_URL` | URL de este backend; arma los webhooks de Mercado Pago |
| `FRONTEND_BASE_URL` | URL del frontend; arma el link de reseteo de contraseña |
| `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_PUBLIC_KEY` | Checkout Pro |
| `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Subida de imágenes |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Mails de reseteo de contraseña |
| `WHATSAPP_CHECKOUT_PHONE` | Teléfono del checkout por WhatsApp |

Tuneo opcional del pool (los defaults ya sirven): `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`,
`DB_POOL_TIMEOUT`, `DB_CONNECT_TIMEOUT`, `DB_POOL_RECYCLE`.

> Si algún día migrás a Supabase, usá el **pooler en modo transacción (puerto 6543)**.
> `app/db.py` lo detecta solo y baja el pool a 2/3, porque con pgBouncer un pool grande del
> lado de la app es contraproducente.

### Verificar que arrancó

```
GET https://<tu-api>.onrender.com/         → {"message": "API Fix It funcionando", ...}
GET https://<tu-api>.onrender.com/docs     → Swagger
```

En los logs vas a ver, por request, `método · ruta · ms · N queries` (logger `fixit.perf`).
Cualquier respuesta trae también los headers `X-Response-Time` y `X-DB-Query-Count`.

---

## 3. Frontend (Vercel)

**Add New → Project** → importá el repo:

| Campo | Valor |
|---|---|
| Root Directory | `client` |
| Framework Preset | Vite |
| Build Command | `npm run build` (default) |
| Output Directory | `dist` (default) |

Variable de entorno:

| Variable | Valor |
|---|---|
| `VITE_API_BASE` | `https://<tu-api>.onrender.com` — **sin barra final** |

`client/vercel.json` ya tiene el rewrite de SPA para que las rutas de React Router funcionen
en recarga directa.

> Las variables `VITE_*` se **incrustan en el bundle en build time**. Si cambiás
> `VITE_API_BASE` tenés que redesplegar; no alcanza con guardarla.

---

## 4. Orden de despliegue

Hay una dependencia circular de URLs. Resolvela así:

1. Creá la DB.
2. Desplegá el backend con `ALLOWED_ORIGINS=*` provisorio.
3. Desplegá el frontend con `VITE_API_BASE` apuntando al backend.
4. Volvé al backend y poné `ALLOWED_ORIGINS` con el dominio real de Vercel. Redesplegá.

---

## 5. El cold start del plan free

El free tier de Render **duerme la instancia tras 15 minutos de inactividad y tarda ~50 s en
despertar**. Es, de lejos, lo que más pesa en la lentitud percibida, y ninguna optimización de
código lo corrige.

Opciones:

- **Plan pago** — la única solución real.
- **Ping externo periódico** — mantiene la instancia despierta, pero consume las 750 horas
  gratis del mes (24/7 son ~730 h). No es gratis: mueve el costo.
- **Convivir con él** — razonable si el tráfico es esporádico, sabiendo que el primer visitante
  tras un rato de inactividad espera ~50 s.

Al medir rendimiento, hacelo siempre **con la instancia ya despierta**. Un cold start no es
una regresión.
