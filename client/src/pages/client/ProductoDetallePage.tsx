import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAccessToken } from '../../lib/auth'
import { mediaUrl } from '../../services/api'
import { carritoApi } from '../../services/carritoApi'
import { productosApi } from '../../services/productosApi'
import type { ProductoDetalle } from '../../types/carrito'

const WHATSAPP_PHONE = import.meta.env.VITE_WHATSAPP_CHECKOUT_PHONE ?? '5493816226300'

function money(value: string | number): string {
  const amount = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(amount)) return '$0'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount)
}

function moneyUsd(value: string | number): string {
  const amount = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(amount)) return 'USD 0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function buildWhatsAppUrl(productName: string): string {
  const phone = WHATSAPP_PHONE.replace(/\D/g, '')
  const message = `Hola, quisiera consultar disponibilidad de ${productName}.`
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

/** Alineado con tienda backend: quita la palabra comercial "nuevo" del titulo. */
function tituloSinEtiquetaNuevo(nombre: string): string {
  let s = nombre.trim()
  if (!s) return ''
  s = s.replace(/\s*-\s*nuevo\s*$/giu, '')
  s = s.replace(/\s+nuevo\s*$/giu, '')
  s = s.replace(/^nuevo\s+[-·,]\s*/giu, '')
  s = s.replace(/\bnuevo\b/giu, '')
  s = s.replace(/\s{2,}/gu, ' ').replace(/^[\s–·-]+|[\s–·-]+$/gu, '')
  return s || nombre.trim()
}

export default function ProductoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const [producto, setProducto] = useState<ProductoDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [showUsdPrice, setShowUsdPrice] = useState(false)
  const [dolarRate, setDolarRate] = useState<number | null>(null)
  const [loadingDolar, setLoadingDolar] = useState(true)
  const [selectedVarianteId, setSelectedVarianteId] = useState<number | null>(null)

  useEffect(() => {
    let alive = true

    async function load() {
      setError(null)
      setLoading(true)
      const parsedId = Number(id)
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        setError('Producto inválido')
        setLoading(false)
        return
      }
      try {
        const data = await productosApi.get(parsedId)
        if (!alive) return
        setProducto(data)
        const defaultVar = data.variantes_tienda?.[0]
        setSelectedVarianteId(defaultVar?.id_producto ?? data.id)
        setShowUsdPrice(false)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'No se pudo cargar el detalle del producto')
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }

    void load()
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    let alive = true

    async function loadDolarRate() {
      setLoadingDolar(true)
      try {
        const res = await fetch('https://dolarapi.com/v1/dolares/blue')
        if (!res.ok) throw new Error('No se pudo obtener dolar blue')
        const data = (await res.json()) as { venta?: number }
        if (!alive) return
        if (typeof data.venta === 'number' && data.venta > 0) {
          setDolarRate(data.venta)
        } else {
          setDolarRate(1100)
        }
      } catch {
        if (!alive) return
        setDolarRate(1100)
      } finally {
        if (alive) setLoadingDolar(false)
      }
    }

    void loadDolarRate()
    return () => {
      alive = false
    }
  }, [])

  async function handleAddToCart() {
    if (!producto) return
    setAdding(true)
    setFeedback(null)
    try {
      const productoTarget =
        selectedVarianteId && Number.isInteger(selectedVarianteId) && selectedVarianteId > 0
          ? selectedVarianteId
          : producto.id
      await carritoApi.addItem(productoTarget, 1, !!getAccessToken())
      setFeedback('Producto agregado al carrito.')
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'No se pudo agregar al carrito.')
    } finally {
      setAdding(false)
    }
  }

  function handleConsultAvailability() {
    if (!producto) return
    window.open(buildWhatsAppUrl(producto.nombre), '_self')
  }

  const precioArsNumber =
    (() => {
      if (!producto) return Number.NaN
      const varianteActiva = producto.variantes_tienda?.find((v) => v.id_producto === selectedVarianteId)
      const precio = varianteActiva?.precio ?? producto.precio
      return typeof precio === 'string' ? Number(precio) : precio
    })()
  const precioUsdConvertido =
    Number.isFinite(precioArsNumber) && dolarRate && dolarRate > 0
      ? precioArsNumber / dolarRate
      : null
  const varianteActiva = useMemo(
    () => producto?.variantes_tienda?.find((v) => v.id_producto === selectedVarianteId) ?? null,
    [producto, selectedVarianteId],
  )
  const fotoActiva = varianteActiva?.foto_url ?? producto?.detalle_equipo?.foto_url ?? null

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-900">
          ← Volver al inicio
        </Link>
        <Link to="/carrito" className="text-sm text-gray-500 hover:text-gray-900">
          Ir al carrito →
        </Link>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-gray-100 bg-white p-8 text-gray-500">Cargando detalle...</div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">{error}</div>
      ) : !producto ? (
        <div className="rounded-3xl border border-gray-100 bg-white p-8 text-gray-500">No se encontró el producto.</div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
          <article className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-gray-400 uppercase">
              {producto.tipo_producto ?? 'producto'}
            </p>
            <h1 className="mb-3 text-3xl font-black tracking-tight text-gray-900">
              {tituloSinEtiquetaNuevo(producto.nombre)}
            </h1>
            {producto.variantes_tienda && producto.variantes_tienda.length > 0 ? (
              <div className="mb-5">
                <label htmlFor="variante-tienda" className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Color
                </label>
                <select
                  id="variante-tienda"
                  value={selectedVarianteId ?? producto.id}
                  onChange={(e) => setSelectedVarianteId(Number(e.target.value))}
                  className="w-full max-w-md rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
                >
                  {producto.variantes_tienda.map((va) => (
                    <option key={va.id_producto} value={va.id_producto}>
                      {(va.color || va.nombre_corto || `Opción ${va.id_producto}`) +
                        ` · ${money(va.precio)} · Stock: ${va.stock ?? 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {producto.detalle_equipo?.estado_comercial?.toLowerCase() === 'usado' ? (
              <div className="mb-3 flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={showUsdPrice}
                  aria-label="Mostrar precio en USD"
                  onClick={() => {
                    if (!precioUsdConvertido) return
                    setShowUsdPrice((v) => !v)
                  }}
                  disabled={!precioUsdConvertido}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showUsdPrice ? 'bg-gray-900' : 'bg-gray-300'
                  } ${!precioUsdConvertido ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      showUsdPrice ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
                  Mostrar precio en USD
                </span>
              </div>
            ) : null}
            <p className="mb-6 text-4xl font-black text-gray-900">
              {showUsdPrice && precioUsdConvertido != null
                ? moneyUsd(precioUsdConvertido)
                : money(varianteActiva?.precio ?? producto.precio)}
            </p>
            {varianteActiva ? (
              <p className="mb-3 text-xs text-gray-500">
                Variante: {varianteActiva.color ?? 'Sin color'} · Stock: {varianteActiva.stock ?? 1}
              </p>
            ) : null}
            {producto.detalle_equipo?.estado_comercial?.toLowerCase() === 'usado' ? (
              <p className="mb-4 text-xs text-gray-500">
                {loadingDolar
                  ? 'Cotizacion USD: cargando...'
                  : dolarRate
                    ? `Cotizacion USD oficial: ${money(dolarRate)}`
                    : 'Cotizacion USD no disponible'}
              </p>
            ) : null}
            <p className="mb-7 text-sm leading-relaxed text-gray-600">
              {producto.descripcion?.trim() || 'Sin descripción disponible.'}
            </p>

            {producto.detalle_equipo && (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <h2 className="mb-3 text-sm font-bold tracking-wide text-gray-900 uppercase">Detalle del equipo</h2>
                <dl className="grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                  <div>
                    <dt className="text-gray-400">Modelo</dt>
                    <dd>{producto.detalle_equipo.nombre_modelo ?? '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Capacidad</dt>
                    <dd>
                      {producto.detalle_equipo.capacidad_gb != null
                        ? `${producto.detalle_equipo.capacidad_gb} GB`
                        : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Color</dt>
                    <dd>{producto.detalle_equipo.color ?? '-'}</dd>
                  </div>
                  {(producto.detalle_equipo.estado_comercial ?? '').toLowerCase().trim() === 'usado' ? (
                    <div>
                      <dt className="text-gray-400">Condición</dt>
                      <dd>{producto.detalle_equipo.estado_comercial}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            )}

            {producto.detalle_accesorio && (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <h2 className="mb-3 text-sm font-bold tracking-wide text-gray-900 uppercase">Detalle del accesorio</h2>
                <dl className="grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                  <div>
                    <dt className="text-gray-400">Tipo</dt>
                    <dd>{producto.detalle_accesorio.tipo}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Color</dt>
                    <dd>{producto.detalle_accesorio.color ?? '-'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-gray-400">Descripción</dt>
                    <dd>{producto.detalle_accesorio.descripcion ?? '-'}</dd>
                  </div>
                </dl>
              </div>
            )}
          </article>

          <aside className="rounded-3xl border border-gray-200 bg-gray-900 p-8 text-white shadow-sm">
            {fotoActiva ? (
              <img
                src={mediaUrl(fotoActiva)}
                alt={producto.nombre}
                className="mb-5 h-56 w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="mb-5 flex h-56 w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-sm text-white/75">
                Sin imagen disponible
              </div>
            )}

            <p className="mb-5 text-sm text-white/75">
              Si querés confirmarlo antes de comprar, consultanos por WhatsApp y te respondemos con la disponibilidad
              actual.
            </p>

            {producto.activo ? (
              <button
                type="button"
                onClick={() => {
                  void handleAddToCart()
                }}
                disabled={adding}
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition-colors duration-150 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adding ? 'Agregando...' : 'Agregar al carrito'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConsultAvailability}
                className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-gray-950 transition-colors duration-150 hover:bg-emerald-300"
              >
                Consultar disponibilidad
              </button>
            )}

            {feedback && <p className="mt-3 text-sm text-emerald-200">{feedback}</p>}
          </aside>
        </div>
      )}
    </section>
  )
}
