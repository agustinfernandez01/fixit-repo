import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAccessToken } from '../../lib/auth'
import { CART_CHANGED_EVENT, type CartChangedDetail } from '../../lib/cart'
import { carritoApi } from '../../services/carritoApi'
import type { CarritoResumen } from '../../types/carrito'

function fmtArs(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

function tipoLabel(tipo: 'equipo' | 'accesorio' | null | undefined) {
  if (tipo === 'equipo') return 'Equipo'
  if (tipo === 'accesorio') return 'Accesorio'
  return 'Producto'
}

export default function CarritoPage() {
  const [summary, setSummary] = useState<CarritoResumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await carritoApi.ensure(!!getAccessToken())
      const data = await carritoApi.summary(!!getAccessToken())
      setSummary(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el carrito')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const onCartChanged = (ev: Event) => {
      const detail = (ev as CustomEvent<CartChangedDetail>).detail
      if (detail?.summary) {
        setSummary(detail.summary as CarritoResumen)
        return
      }
      void load()
    }
    window.addEventListener(CART_CHANGED_EVENT, onCartChanged)
    return () => window.removeEventListener(CART_CHANGED_EVENT, onCartChanged)
  }, [load])

  async function updateQty(id: number, cant: number) {
    setBusyId(id)
    try {
      const data = await carritoApi.updateItem(id, cant, !!getAccessToken())
      setSummary(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el carrito')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: number) {
    setBusyId(id)
    try {
      const data = await carritoApi.removeItem(id, !!getAccessToken())
      setSummary(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el item')
    } finally {
      setBusyId(null)
    }
  }

  async function clearAll() {
    setBusyId(-1)
    try {
      const data = await carritoApi.clear(!!getAccessToken())
      setSummary(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo vaciar el carrito')
    } finally {
      setBusyId(null)
    }
  }

  const items = summary?.items ?? []

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1.5 text-[11px] tracking-widest text-gray-300 uppercase">
              Fix It · carrito
            </p>
            <h1 className="text-3xl font-black tracking-tight text-gray-900">Tu carrito</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400">
              Ajustá cantidades, eliminá items o seguí comprando en la tienda.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/tienda"
              className="inline-flex items-center justify-center rounded-full border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900"
            >
              Seguir comprando
            </Link>
            <button
              type="button"
              onClick={() => void clearAll()}
              className="inline-flex items-center justify-center rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              Vaciar carrito
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-gray-400">Cargando carrito…</p>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/80 px-8 py-16 text-center">
            <p className="text-gray-500">
              Tu carrito está vacío.{' '}
              <Link to="/tienda" className="font-medium text-gray-900 underline">
                Ir a la tienda
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
            <div className="space-y-4">
              {items.map((item) => {
                const producto = item.producto
                return (
                  <article
                    key={item.id}
                    className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[11px] tracking-widest text-gray-300 uppercase">
                          {producto?.nombre ?? `Producto #${item.id_producto}`}
                        </p>
                        <p className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-gray-500 uppercase">
                          {tipoLabel(producto?.tipo_producto)}
                        </p>
                        <h2 className="mt-1 text-lg font-bold text-gray-900">
                          {producto?.nombre ?? 'Producto sin nombre'}
                        </h2>
                        <p className="mt-1 text-sm text-gray-400">
                          Unitario: {fmtArs(item.precio_unitario)} · Subtotal: {fmtArs(item.subtotal)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busyId === item.id || item.cant <= 1}
                          onClick={() => void updateQty(item.id, item.cant - 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition-colors hover:border-gray-400 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="min-w-10 text-center text-sm font-semibold text-gray-900">
                          {item.cant}
                        </span>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void updateQty(item.id, item.cant + 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition-colors hover:border-gray-400 disabled:opacity-40"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void remove(item.id)}
                          className="ml-2 rounded-full border border-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-40"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            <aside className="h-fit rounded-3xl border border-gray-100 bg-gray-50 p-6 shadow-sm">
              <p className="text-[11px] tracking-widest text-gray-300 uppercase">Resumen</p>
              <div className="mt-4 space-y-3 text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Items</span>
                  <strong className="text-gray-900">{summary?.total_unidades ?? 0}</strong>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                  <span>Total</span>
                  <strong className="text-lg text-gray-900">{fmtArs(summary?.total_importe)}</strong>
                </div>
              </div>
              <button
                type="button"
                className="mt-6 w-full rounded-full bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700"
              >
                Continuar con el checkout
              </button>
              <p className="mt-3 text-xs leading-relaxed text-gray-400">
                El checkout todavía no está conectado. Este panel ya te deja operar el carrito completo.
              </p>
            </aside>
          </div>
        )}
      </section>
    </div>
  )
}