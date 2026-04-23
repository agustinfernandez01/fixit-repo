import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { carritoApi } from '../../services/carritoApi'
import { productosApi } from '../../services/productosApi'
import type { ProductoCompra } from '../../types/carrito'
import { getAccessToken } from '../../lib/auth'
import { mediaUrl } from '../../services/api'
import productosAppleFilterImg from '../../assets/filtradocatalogoimg/productos-apple.svg'
import accesoriosFilterImg from '../../assets/filtradocatalogoimg/accesorios.svg'

function fmtArs(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  const n =
    typeof v === 'string'
      ? Number(String(v).trim().replace(/\./g, '').replace(',', '.'))
      : v
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtUsd(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

type CatalogCategory = 'apple' | 'accesorios'
type SortMode = 'featured' | 'price-asc' | 'price-desc' | 'name'
type VisibleCategory = CatalogCategory
type CatalogSubcategory =
  | 'all'
  | 'iphone'
  | 'ipad'
  | 'macbook'
  | 'watch'
  | 'airpods'
  | 'funda'
  | 'templado'
  | 'cabezal'
  | 'cable'

type CatalogItem = ProductoCompra & {
  category: CatalogCategory
  familyLabel: string
}

const APPLE_SUBCATEGORY_OPTIONS: Array<{
  id: CatalogSubcategory
  label: string
}> = [
  { id: 'all', label: 'Todos' },
  { id: 'iphone', label: 'iPhone' },
  { id: 'ipad', label: 'iPad' },
  { id: 'macbook', label: 'MacBook' },
  { id: 'watch', label: 'Apple Watch' },
  { id: 'airpods', label: 'AirPods' },
]

const ACCESORIOS_SUBCATEGORY_OPTIONS: Array<{
  id: CatalogSubcategory
  label: string
}> = [
  { id: 'all', label: 'Todos' },
  { id: 'funda', label: 'Fundas' },
  { id: 'templado', label: 'Templados' },
  { id: 'cabezal', label: 'Cabezales' },
  { id: 'cable', label: 'Cables' },
]

const ITEMS_PER_PAGE = 9

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? 0 : n
  }
  return 0
}

function isAccessoryByName(name: string): boolean {
  return [
    'funda',
    'cargador',
    'cable',
    'cabezal',
    'airpods',
    'glass',
    'templado',
    'protector',
    'soporte',
    'adaptador',
    'auricular',
    'airpods',
    'power bank',
    'bateria externa',
    'mouse',
    'teclado',
  ].some((w) => name.includes(w))
}

function inferFamilyLabel(name: string): string {
  if (name.includes('iphone')) return 'iPhone'
  if (name.includes('ipad')) return 'iPad'
  if (name.includes('macbook')) return 'MacBook'
  if (name.includes('apple watch') || name.includes('watch')) return 'Watch'
  if (name.includes('airpods')) return 'AirPods'
  if (isAccessoryByName(name)) return 'Accesorio'
  return 'Producto'
}

function inferFamilyFromTipoEquipo(tipoEquipo: string | null | undefined): string | null {
  const t = normalize(tipoEquipo)
  if (!t) return null
  if (t.includes('iphone')) return 'iPhone'
  if (t.includes('ipad') || t.includes('tablet')) return 'iPad'
  if (t.includes('watch')) return 'Watch'
  if (t.includes('macbook') || t.includes('mac')) return 'MacBook'
  if (t.includes('airpods')) return 'AirPods'
  if (t.includes('cable')) return 'Cable'
  if (t.includes('funda')) return 'Funda'
  if (t.includes('cabezal')) return 'Cabezal'
  return t
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

function classifyCategory(producto: ProductoCompra): CatalogCategory {
  const name = normalize(producto.nombre)

  if (producto.tipo_producto === 'accesorio') return 'accesorios'

  const tipoEquipo = normalize(producto.tipo_equipo)
  if (
    tipoEquipo.includes('airpods') ||
    tipoEquipo.includes('funda') ||
    tipoEquipo.includes('cable') ||
    tipoEquipo.includes('cabezal') ||
    tipoEquipo.includes('accesorio')
  ) {
    return 'accesorios'
  }

  if (
    tipoEquipo.includes('iphone') ||
    tipoEquipo.includes('ipad') ||
    tipoEquipo.includes('macbook')
  ) {
    return 'apple'
  }

  if (producto.tipo_producto === 'equipo') return 'apple'

  if (isAccessoryByName(name)) return 'accesorios'
  return 'apple'
}

function toCatalogItem(producto: ProductoCompra): CatalogItem {
  const normalizedName = normalize(producto.nombre)
  const familyByTipo = inferFamilyFromTipoEquipo(producto.tipo_equipo)
  return {
    ...producto,
    category: classifyCategory(producto),
    familyLabel: familyByTipo ?? inferFamilyLabel(normalizedName),
  }
}

function itemMatchesSubcategory(
  item: CatalogItem,
  subcategory: CatalogSubcategory,
): boolean {
  if (subcategory === 'all') return true

  const haystack = `${normalize(item.nombre)} ${normalize(item.descripcion)} ${normalize(item.tipo_equipo)} ${normalize(item.familyLabel)}`

  if (subcategory === 'iphone') return haystack.includes('iphone')
  if (subcategory === 'ipad') return haystack.includes('ipad') || haystack.includes('tablet')
  if (subcategory === 'macbook') return haystack.includes('macbook') || haystack.includes('mac')
  if (subcategory === 'watch') return haystack.includes('watch')
  if (subcategory === 'airpods') return haystack.includes('airpods')

  if (subcategory === 'funda') return haystack.includes('funda')
  if (subcategory === 'templado') {
    return (
      haystack.includes('templado') ||
      haystack.includes('glass') ||
      haystack.includes('protector')
    )
  }
  if (subcategory === 'cabezal') {
    return haystack.includes('cabezal') || haystack.includes('cargador')
  }
  if (subcategory === 'cable') {
    return haystack.includes('cable') || haystack.includes('adaptador')
  }

  return true
}

function paletteByCategory(category: CatalogCategory): {
  backdrop: string
  swatches: string[]
  tag: string
} {
  if (category === 'accesorios') {
    return {
      backdrop: 'bg-gradient-to-b from-amber-100/75 via-orange-50/70 to-white',
      swatches: ['bg-amber-100', 'bg-orange-200', 'bg-zinc-700'],
      tag: 'Accesorio',
    }
  }
  return {
    backdrop: 'bg-gradient-to-b from-neutral-200/90 via-stone-100/80 to-white',
    swatches: ['bg-stone-200', 'bg-neutral-100', 'bg-slate-800'],
    tag: 'Apple',
  }
}

function ProductMockup({ category }: { category: CatalogCategory }) {
  if (category === 'accesorios') {
    return (
      <div className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="h-20 w-20 rounded-2xl border border-neutral-300 bg-neutral-50" />
        <div className="absolute -bottom-2 h-1.5 w-20 rounded-full bg-neutral-200" />
      </div>
    )
  }

  return (
    <div className="relative mx-auto flex h-44 w-24 flex-col items-center rounded-[1.9rem] border border-[1.5px] border-gray-200 bg-white pb-2.5 pt-2.5 shadow-sm">
      <div className="mb-1.5 h-3.5 w-10 rounded-full bg-gray-200" />
      <div className="w-[88%] flex-1 space-y-1 overflow-hidden rounded-xl bg-gray-100 p-2">
        <div className="h-1.5 w-3/4 rounded-full bg-gray-200" />
        <div className="h-1.5 w-1/2 rounded-full bg-gray-200 opacity-60" />
        <div className="mt-2 h-14 rounded-lg bg-gray-200 opacity-40" />
      </div>
      <div className="mt-2 h-1 w-8 rounded-full bg-gray-200" />
    </div>
  )
}

function sortItems(items: CatalogItem[], mode: SortMode): CatalogItem[] {
  const sorted = [...items]
  if (mode === 'price-asc') {
    sorted.sort((a, b) => toNumber(a.precio) - toNumber(b.precio))
    return sorted
  }
  if (mode === 'price-desc') {
    sorted.sort((a, b) => toNumber(b.precio) - toNumber(a.precio))
    return sorted
  }
  if (mode === 'name') {
    sorted.sort((a, b) => a.nombre.localeCompare(b.nombre))
    return sorted
  }

  sorted.sort((a, b) => {
    const byType = (a.category === 'apple' ? 1 : 0) - (b.category === 'apple' ? 1 : 0)
    if (byType !== 0) return -byType
    return toNumber(b.precio) - toNumber(a.precio)
  })
  return sorted
}

function ProductCard({
  item,
  saving,
  onAdd,
}: {
  item: CatalogItem
  saving: boolean
  onAdd: (id: number) => void
}) {
  const p = paletteByCategory(item.category)
  const imageSrc = mediaUrl(item.foto_url)
  const hasUsd = item.precio_usd !== null && item.precio_usd !== undefined && item.precio_usd !== ''
  return (
    <article className="flex flex-col items-center text-center">
      <div
        className={`relative w-full overflow-hidden rounded-[2rem] shadow-[0_12px_48px_-20px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.03] ${p.backdrop}`}
      >
        <div className="relative flex h-[280px] w-full items-center justify-center sm:h-[320px] md:h-[340px]">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={item.nombre}
              className="max-h-full w-auto max-w-[min(100%,280px)] object-contain object-center mix-blend-multiply sm:max-w-[300px] md:max-w-[320px]"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ProductMockup category={item.category} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex justify-center gap-2.5 sm:mt-4" aria-hidden>
        {p.swatches.map((sw, i) => (
          <span key={`${item.id}-sw-${i}`} className={`h-2.5 w-2.5 rounded-full ring-1 ring-black/[0.08] ${sw}`} />
        ))}
      </div>

      <p className="mt-3 text-[11px] font-semibold tracking-[0.02em] text-neutral-500 uppercase">{p.tag}</p>

      <h3 className="mt-1.5 max-w-[18rem] text-[1.375rem] font-semibold leading-tight tracking-[-0.025em] text-neutral-900 sm:text-[1.5rem]">
        {item.nombre}
      </h3>

      <p className="mt-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">{item.familyLabel}</p>

      <p className="mx-auto mt-2.5 max-w-[20rem] text-[15px] leading-snug text-neutral-600">
        {item.descripcion ?? 'Producto disponible en catálogo.'}
      </p>

      <div className="mx-auto mt-3 flex max-w-[22rem] flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
        {hasUsd ? (
          <span className="inline-flex items-center rounded-full bg-[#0071e3]/10 px-3 py-1 text-[13px] font-semibold text-[#0071e3]">
            USD {fmtUsd(item.precio_usd).replace('$', '').trim()}
          </span>
        ) : null}
        <span className={`${hasUsd ? 'text-xs text-neutral-500' : 'text-xs text-neutral-700 sm:text-[13px]'}`}>
          {hasUsd ? `ARS ${fmtArs(item.precio).replace('$', '').trim()}` : fmtArs(item.precio)}
        </span>
      </div>

      <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
        <button
          type="button"
          onClick={() => onAdd(item.id)}
          disabled={saving}
          className="inline-flex min-h-[2.75rem] min-w-[9rem] items-center justify-center rounded-full bg-[#0071e3] px-7 text-[15px] font-normal text-white transition-colors hover:bg-[#0077ed] active:bg-[#006edb] disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? 'Agregando…' : 'Agregar al carrito'}
        </button>
        <Link
          to={`/producto/${item.id}`}
          className="inline-flex items-center gap-0.5 text-[15px] font-normal text-[#0071e3] transition-colors hover:underline"
        >
          Ver detalle
          <span aria-hidden className="text-lg leading-none">
            ›
          </span>
        </Link>
      </div>
    </article>
  )
}

function ProductCardSkeleton() {
  return (
    <article className="flex flex-col items-center text-center">
      <div className="relative w-full overflow-hidden rounded-[2rem] shadow-[0_12px_48px_-20px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.03]">
        <div className="h-[280px] w-full animate-pulse bg-neutral-100 sm:h-[320px] md:h-[340px]" />
      </div>

      <div className="mt-3 flex justify-center gap-2.5 sm:mt-4" aria-hidden>
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-neutral-100" />
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-neutral-100" />
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-neutral-100" />
      </div>

      <div className="mt-3 h-4 w-14 animate-pulse rounded bg-neutral-100" />
      <div className="mt-2 h-7 w-4/5 animate-pulse rounded-xl bg-neutral-100" />
      <div className="mt-2 h-4 w-24 animate-pulse rounded bg-neutral-100" />
      <div className="mt-3 h-5 w-full max-w-[20rem] animate-pulse rounded bg-neutral-100" />
      <div className="mt-1 h-5 w-5/6 max-w-[20rem] animate-pulse rounded bg-neutral-100" />
      <div className="mt-3 h-4 w-28 animate-pulse rounded bg-neutral-100" />

      <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
        <div className="h-11 w-40 animate-pulse rounded-full bg-neutral-100" />
        <div className="h-6 w-28 animate-pulse rounded bg-neutral-100" />
      </div>
    </article>
  )
}

export default function TiendaPage() {
  const [items, setItems] = useState<ProductoCompra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [visibleCategory, setVisibleCategory] = useState<VisibleCategory>('apple')
  const [selectedSubcategory, setSelectedSubcategory] = useState<CatalogSubcategory>('all')
  const [sortMode, setSortMode] = useState<SortMode>('featured')
  const [currentPage, setCurrentPage] = useState(1)

  const visualFilters: Array<{
    id: VisibleCategory
    label: string
    image: string
  }> = [
    { id: 'apple', label: 'Productos Apple', image: productosAppleFilterImg },
    { id: 'accesorios', label: 'Accesorios', image: accesoriosFilterImg },
  ]

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await productosApi.list()
      setItems(data.filter((p) => p.activo && !isRepairProduct(p)))
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

  const catalogItems = useMemo(() => items.map(toCatalogItem), [items])

  const filtered = useMemo(() => {
    const q = normalize(search)
    let data = catalogItems.filter((item) => item.category === visibleCategory)
    data = data.filter((item) => itemMatchesSubcategory(item, selectedSubcategory))
    if (q) {
      data = data.filter((item) => {
        const hay = `${normalize(item.nombre)} ${normalize(item.descripcion)} ${normalize(item.familyLabel)}`
        return hay.includes(q)
      })
    }
    return sortItems(data, sortMode)
  }, [catalogItems, visibleCategory, selectedSubcategory, search, sortMode])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filtered.slice(start, start + ITEMS_PER_PAGE)
  }, [filtered, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [visibleCategory, selectedSubcategory, search, sortMode])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const subcategoryOptions =
    visibleCategory === 'apple'
      ? APPLE_SUBCATEGORY_OPTIONS
      : ACCESORIOS_SUBCATEGORY_OPTIONS

  const sectionTitle =
    visibleCategory === 'apple'
      ? 'Productos Apple'
      : 'Accesorios'

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1.5 text-[10px] font-medium tracking-[0.22em] text-neutral-400 uppercase">
              Fix It · catálogo
            </p>
            <h1 className="text-4xl font-semibold tracking-[-0.03em] text-neutral-900">
              Tienda de productos
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
              Explorá dos categorías claras para vender mejor: <strong className="font-semibold text-neutral-700">Productos Apple</strong> y <strong className="font-semibold text-neutral-700">Accesorios</strong>. Buscá, filtrá y agregá al carrito en un flujo de catálogo profesional.
            </p>
          </div>
        </div>

        <div className="mb-10 rounded-[1.6rem] border border-neutral-200 bg-[#f5f5f7] p-4 sm:p-5">
          <div className="mb-5 flex gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visualFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => {
                  setVisibleCategory(filter.id)
                  setSelectedSubcategory('all')
                }}
                className={`group flex min-w-[150px] flex-col items-center gap-2 rounded-2xl px-3 py-2 transition-colors ${
                  visibleCategory === filter.id ? 'bg-white shadow-sm' : 'hover:bg-white/70'
                }`}
              >
                <img
                  src={filter.image}
                  alt={filter.label}
                  className="h-[64px] w-auto max-w-[120px] object-contain"
                  loading="lazy"
                />
                <span className="text-sm font-medium text-neutral-800">{filter.label}</span>
              </button>
            ))}
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {subcategoryOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedSubcategory(option.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedSubcategory === option.id
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_auto] lg:items-end">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold tracking-widest text-neutral-400 uppercase">Buscar</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="iPhone 15, MacBook, funda, cargador..."
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-400"
              />
            </label>

            <label className="block min-w-[210px]">
              <span className="mb-1 block text-[11px] font-semibold tracking-widest text-neutral-400 uppercase">Orden</span>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-400"
              >
                <option value="featured">Relevancia</option>
                <option value="price-asc">Precio: menor a mayor</option>
                <option value="price-desc">Precio: mayor a menor</option>
                <option value="name">Nombre (A-Z)</option>
              </select>
            </label>
          </div>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-7">
            <section>
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <p className="mb-1 text-[11px] tracking-widest text-neutral-400 uppercase">Categoría</p>
                  <div className="h-9 w-56 animate-pulse rounded-xl bg-neutral-100" />
                </div>
                <div className="h-8 w-28 animate-pulse rounded-full bg-neutral-100" />
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: ITEMS_PER_PAGE }, (_, i) => (
                  <ProductCardSkeleton key={`sk-${i}`} />
                ))}
              </div>
            </section>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/80 px-8 py-16 text-center">
            <p className="text-gray-500">No encontramos productos para esos filtros.</p>
          </div>
        ) : (
          <div className="space-y-7">
            <section>
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <p className="mb-1 text-[11px] tracking-widest text-neutral-400 uppercase">Categoría</p>
                  <h2 className="text-3xl font-semibold tracking-[-0.03em] text-neutral-900">{sectionTitle}</h2>
                </div>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
                  {filtered.length} disponibles
                </span>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedItems.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    saving={savingId === item.id}
                    onAdd={(id) => {
                      void addToCart(id)
                    }}
                  />
                ))}
              </div>
            </section>

            {totalPages > 1 ? (
              <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Paginación de catálogo">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`h-9 min-w-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                      page === currentPage
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente
                </button>
              </nav>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}