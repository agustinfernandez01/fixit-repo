import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { carritoApi } from '../../services/carritoApi'
import { mediaUrl } from '../../services/api'
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

function buildWhatsAppUrl(productName: string): string {
  const phone = WHATSAPP_PHONE.replace(/\D/g, '')
  const message = `Hola, quisiera consultar disponibilidad de ${productName}.`
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

export default function ProductoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const [producto, setProducto] = useState<ProductoDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

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

  async function handleAddToCart() {
    if (!producto) return
    setAdding(true)
    setFeedback(null)
    try {
      await carritoApi.addItem(producto.id, 1)
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
            <h1 className="mb-3 text-3xl font-black tracking-tight text-gray-900">{producto.nombre}</h1>
            <p className="mb-6 text-4xl font-black text-gray-900">{money(producto.precio)}</p>
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
                  <div>
                    <dt className="text-gray-400">Condición</dt>
                    <dd>{producto.detalle_equipo.estado_comercial ?? '-'}</dd>
                  </div>
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
            {producto.detalle_equipo?.foto_url ? (
              <img
                src={mediaUrl(producto.detalle_equipo.foto_url)}
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
