import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAccessToken } from '../../lib/auth'
import { carritoApi } from '../../services/carritoApi'
import { inventarioApi } from '../../services/inventarioApi'
import { productosApi } from '../../services/productosApi'
import { isRepairProduct, isUsedProduct, normalizeCatalogText } from '../../lib/catalogProductRules'
import type { ProductoCompra } from '../../types/carrito'
import { ProductShowcaseCard } from '../../components/ProductShowcaseCard'

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

function modelLabelFromProduct(producto: ProductoCompra): string {
  const source = `${producto.nombre ?? ''} ${producto.tipo_equipo ?? ''}`
  const normalized = normalizeCatalogText(source)

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
      const [data, detallesUsado, equipos] = await Promise.all([
        productosApi.list(),
        inventarioApi.equiposUsadosDetalle.list(0, 100),
        inventarioApi.equipos.list(0, 100),
      ])
      const equipoToProducto = new Map<number, number>()
      for (const equipo of equipos) {
        const idEquipo = equipo.id ?? equipo.id_equipo
        if (idEquipo == null || equipo.id_producto == null) continue
        equipoToProducto.set(idEquipo, equipo.id_producto)
      }
      const productosUsadosConDetalle = new Set<number>()
      for (const detalle of detallesUsado) {
        const idProducto = equipoToProducto.get(detalle.id_equipo)
        if (idProducto != null) {
          productosUsadosConDetalle.add(idProducto)
        }
      }
      setItems(
        data.filter(
          (p) =>
            p.activo &&
            p.tipo_producto === 'equipo' &&
            isUsedProduct(p) &&
            productosUsadosConDetalle.has(p.id) &&
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

  const visibleProducts = useMemo(() => {
    if (selectedModel === 'all') {
      return usedByModel.flatMap((group) => group.productos)
    }
    return visibleGroups[0]?.productos ?? []
  }, [selectedModel, usedByModel, visibleGroups])

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

            <section>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="mb-1 text-[11px] tracking-widest text-neutral-400 uppercase">Modelo</p>
                  <h2 className="text-3xl font-semibold tracking-[-0.03em] text-neutral-900">
                    {selectedModel === 'all'
                      ? 'Todos los modelos'
                      : (visibleGroups[0]?.label ?? 'Modelo')}
                  </h2>
                </div>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
                  {visibleProducts.length} disponibles
                </span>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {visibleProducts.map((p) => {
                  const groupLabel =
                    usedByModel.find((g) => g.productos.some((prod) => prod.id === p.id))
                      ?.label ?? 'Usado'
                  return (
                    <ProductShowcaseCard
                      key={p.id}
                      title={p.nombre}
                      description={p.descripcion ?? specsLine(p).join(' · ')}
                      familyLabel={groupLabel}
                      imageUrl={p.foto_url}
                      badgeTag="Usado"
                      arsPrice={p.precio}
                      primaryAction={{
                        label: savingId === p.id ? 'Agregando…' : 'Agregar al carrito',
                        onClick: () => {
                          void addToCart(p.id)
                        },
                        disabled: savingId === p.id,
                      }}
                      detailTo={`/producto/${p.id}`}
                    />
                  )
                })}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  )
}
