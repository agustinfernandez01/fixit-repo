import { useCallback, useEffect, useState } from 'react'
import { carritoApi } from '../../services/carritoApi'
import { productosApi } from '../../services/productosApi'
import type { ProductoCompra } from '../../types/carrito'
import { getAccessToken } from '../../lib/auth'

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

function tipoLabel(tipo: ProductoCompra['tipo_producto']) {
  if (tipo === 'equipo') return 'Equipo'
  if (tipo === 'accesorio') return 'Accesorio'
  return 'Producto'
}

export default function TiendaPage() {
  const [items, setItems] = useState<ProductoCompra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await productosApi.list()
      setItems(data.filter((p) => p.activo))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la tienda')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function addToCart(idProducto: number) {
    setSavingId(idProducto)
    setError(null)
    try {
      const logged = !!getAccessToken()
      await carritoApi.addItem(idProducto, 1, logged)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar al carrito')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1.5 text-[11px] tracking-widest text-gray-300 uppercase">
              Fix It · tienda
            </p>
            <h1 className="text-3xl font-black tracking-tight text-gray-900">
              Catálogo de productos
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400">
              Elegí productos del catálogo y agregalos al carrito. El ícono superior te muestra el total.
            </p>
          </div>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-gray-400">Cargando productos…</p>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/80 px-8 py-16 text-center">
            <p className="text-gray-500">Todavía no hay productos activos para vender.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <article
                key={p.id}
                className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex aspect-[4/3] items-end bg-gradient-to-br from-gray-50 to-white p-5">
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gray-900 text-white shadow-lg">
                    <svg className="h-11 w-11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 3v18m9-9H3" />
                    </svg>
                  </div>
                </div>
                <div className="border-t border-gray-100 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="mb-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-gray-500 uppercase">
                        {tipoLabel(p.tipo_producto)}
                      </p>
                      <h2 className="text-lg font-bold text-gray-900">{p.nombre}</h2>
                      <p className="mt-1 text-sm text-gray-400">{p.descripcion ?? 'Sin descripción'}</p>
                    </div>
                    <p className="text-lg font-black text-gray-900">{fmtArs(p.precio)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void addToCart(p.id)}
                    disabled={savingId === p.id}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-60"
                  >
                    {savingId === p.id ? 'Agregando…' : 'Agregar al carrito'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}