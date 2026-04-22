import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAccessToken } from '../../lib/auth'
import { carritoApi } from '../../services/carritoApi'
import { mediaUrl } from '../../services/api'
import { productosApi } from '../../services/productosApi'
import type { ProductoCompra } from '../../types/carrito'

function fmtPrecio(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

function specsLine(p: ProductoCompra): string[] {
  const parts: string[] = []
  if (p.tipo_equipo) parts.push(p.tipo_equipo)
  if (p.tipo_producto) parts.push(p.tipo_producto)
  return parts.length ? parts : ['Equipo usado']
}

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function isRepairProduct(producto: ProductoCompra): boolean {
  const name = normalize(producto.nombre)
  const desc = normalize(producto.descripcion ?? '')
  return (
    name.startsWith('reparación') ||
    name.startsWith('reparacion') ||
    name.includes('reparación -') ||
    name.includes('reparacion -') ||
    desc.includes('servicio de reparación') ||
    desc.includes('servicio de reparacion')
  )
}

function isUsedProduct(producto: ProductoCompra): boolean {
  const t = normalize(producto.tipo_equipo)
  return t.includes('usad') || t.includes('reacond') || t.includes('semi')
}

function modelLabelFromProduct(producto: ProductoCompra): string {
  const source = `${producto.nombre ?? ''} ${producto.tipo_equipo ?? ''}`
  const normalized = normalize(source)

  const iphoneMatch = normalized.match(/iphone\s*(se|[0-9]{1,2})(\s*(pro|max|plus|mini))?/)
  if (iphoneMatch) {
    const base = iphoneMatch[1].toUpperCase() === 'SE' ? 'SE' : iphoneMatch[1]
    const suffix = iphoneMatch[3] ? ` ${iphoneMatch[3].trim().toUpperCase()}` : ''
    return `iPhone ${base}${suffix}`
  }
  if (normalized.includes('iphone')) return 'iPhone (Otros)'
  if (normalized.includes('ipad')) return 'iPad'
  if (normalized.includes('macbook')) return 'MacBook'
  if (normalized.includes('watch')) return 'Apple Watch'
  if (normalized.includes('airpods')) return 'AirPods'

  const cleaned = source
    .replace(/usado|usada|reacondicionado|reacondicionada|semi ?nuevo/gi, '')
    .trim()
  if (!cleaned) return 'Otros usados'
  return toTitleCase(cleaned.split(/\s+/).slice(0, 3).join(' '))
}

function UsedProductCardSkeleton() {
  return (
    <article className="flex flex-col items-center text-center">
      <div className="relative w-full overflow-hidden rounded-[2rem] shadow-[0_12px_48px_-20px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.03]">
        <div className="h-[280px] w-full animate-pulse bg-neutral-100 sm:h-[320px] md:h-[340px]" />
      </div>
      <div className="mt-3 h-4 w-14 animate-pulse rounded bg-neutral-100" />
      <div className="mt-2 h-7 w-4/5 animate-pulse rounded-xl bg-neutral-100" />
      <div className="mt-2 h-4 w-28 animate-pulse rounded bg-neutral-100" />
      <div className="mt-3 h-4 w-24 animate-pulse rounded bg-neutral-100" />
      <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
        <div className="h-11 w-40 animate-pulse rounded-full bg-neutral-100" />
        <div className="h-6 w-28 animate-pulse rounded bg-neutral-100" />
      </div>
    </article>
  )
}

export default function MarketplaceTiendaPage() {
  const [items, setItems] = useState<ProductoCompra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('all')

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await productosApi.list()
      setItems(
        data.filter(
          (p) =>
            p.activo &&
            (p.tipo_producto === 'equipo' || p.tipo_producto == null) &&
            isUsedProduct(p) &&
            !isRepairProduct(p),
        ),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la sección de usados')
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

  const usedByModel = useMemo(() => {
    const bucket = new Map<string, ProductoCompra[]>()
    for (const item of items) {
      const label = modelLabelFromProduct(item)
      const current = bucket.get(label) ?? []
      current.push(item)
      bucket.set(label, current)
    }
    return [...bucket.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, productos]) => ({
        label,
        key: label.toLowerCase(),
        productos,
      }))
  }, [items])

  const visibleGroups = useMemo(() => {
    if (selectedModel === 'all') return usedByModel
    return usedByModel.filter((group) => group.key === selectedModel)
  }, [selectedModel, usedByModel])

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1.5 text-[10px] font-medium tracking-[0.22em] text-neutral-400 uppercase">
              Fix It · catálogo usados
            </p>
            <h1 className="text-4xl font-semibold tracking-[-0.03em] text-neutral-900">
              Equipos usados
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
              Mismo estilo de catálogo y organización por modelo para encontrar más rápido el equipo usado que buscás.
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-8">
            <div className="rounded-[1.6rem] border border-neutral-200 bg-[#f5f5f7] p-4 sm:p-5">
              <div className="mb-2 h-3 w-20 animate-pulse rounded bg-neutral-200" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }, (_, idx) => (
                  <span key={`chip-sk-${idx}`} className="h-8 w-24 animate-pulse rounded-full bg-white" />
                ))}
              </div>
            </div>
            <section>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <div className="mb-1 h-3 w-16 animate-pulse rounded bg-neutral-100" />
                  <div className="h-9 w-56 animate-pulse rounded-xl bg-neutral-100" />
                </div>
                <div className="h-7 w-28 animate-pulse rounded-full bg-neutral-100" />
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <UsedProductCardSkeleton key={`used-sk-${i}`} />
                ))}
              </div>
            </section>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/80 px-8 py-16 text-center">
            <p className="text-gray-500">No hay equipos usados disponibles por ahora.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="rounded-[1.6rem] border border-neutral-200 bg-[#f5f5f7] p-4 sm:p-5">
              <p className="mb-2 text-[11px] font-semibold tracking-widest text-neutral-400 uppercase">Modelo</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedModel('all')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedModel === 'all'
                      ? 'bg-neutral-900 text-white'
                      : 'bg-white text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  Todos
                </button>
                {usedByModel.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setSelectedModel(group.key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      selectedModel === group.key
                        ? 'bg-neutral-900 text-white'
                        : 'bg-white text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    {group.label} ({group.productos.length})
                  </button>
                ))}
              </div>
            </div>

            {visibleGroups.map((group) => (
              <section key={group.key}>
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="mb-1 text-[11px] tracking-widest text-neutral-400 uppercase">Modelo</p>
                    <h2 className="text-3xl font-semibold tracking-[-0.03em] text-neutral-900">{group.label}</h2>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
                    {group.productos.length} disponibles
                  </span>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {group.productos.map((p) => {
                    const src = mediaUrl(p.foto_url)
                    return (
                      <article key={p.id} className="flex flex-col items-center text-center">
                        <div className="relative w-full overflow-hidden rounded-[2rem] shadow-[0_12px_48px_-20px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.03] bg-gradient-to-b from-neutral-200/90 via-stone-100/80 to-white">
                          <div className="relative flex h-[280px] w-full items-center justify-center sm:h-[320px] md:h-[340px]">
                            {src ? (
                              <img
                                src={src}
                                alt={p.nombre}
                                className="max-h-full w-auto max-w-[min(100%,280px)] object-contain object-center mix-blend-multiply sm:max-w-[300px] md:max-w-[320px]"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-44 w-24 rounded-[1.9rem] border border-gray-200 bg-white" />
                            )}
                          </div>
                        </div>
                        <p className="mt-3 text-[11px] font-semibold tracking-[0.02em] text-neutral-500 uppercase">
                          Usado
                        </p>
                        <h3 className="mt-1.5 max-w-[18rem] text-[1.3rem] font-semibold leading-tight tracking-[-0.025em] text-neutral-900">
                          {p.nombre}
                        </h3>
                        <p className="mt-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
                          {group.label}
                        </p>
                        <p className="mt-3 text-sm font-semibold text-neutral-900">{fmtPrecio(p.precio)}</p>
                        <ul className="mt-2 flex flex-wrap justify-center gap-1.5">
                          {specsLine(p).slice(0, 2).map((s) => (
                            <li key={s} className="rounded-lg bg-gray-50 px-2.5 py-1 text-[11px] text-gray-500">
                              {s}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
                          <button
                            type="button"
                            onClick={() => void addToCart(p.id)}
                            disabled={savingId === p.id}
                            className="inline-flex min-h-[2.75rem] min-w-[9rem] items-center justify-center rounded-full bg-[#0071e3] px-7 text-[15px] font-normal text-white transition-colors hover:bg-[#0077ed] disabled:opacity-60"
                          >
                            {savingId === p.id ? 'Agregando…' : 'Agregar al carrito'}
                          </button>
                          <Link
                            to={`/producto/${p.id}`}
                            className="inline-flex items-center gap-0.5 text-[15px] font-normal text-[#0071e3] transition-colors hover:underline"
                          >
                            Ver detalle
                            <span aria-hidden className="text-lg leading-none">›</span>
                          </Link>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
