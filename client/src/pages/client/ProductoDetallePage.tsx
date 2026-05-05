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

function tituloFamilia(nombre: string): string {
  const base = tituloSinEtiquetaNuevo(nombre)
  return base.replace(/\b\d{2,4}\s*gb\b/giu, '').replace(/\s{2,}/gu, ' ').trim()
}

function normalizeSpecValue(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

type VarianteTiendaDetalle = NonNullable<ProductoDetalle['variantes_tienda']>[number]

function normalizeAttributeCode(code: string): string {
  const normalized = code.trim().toLowerCase()
  if (normalized === 'gb' || normalized === 'almacenamiento' || normalized === 'storage') {
    return 'almacenamiento'
  }
  return normalized
}

function variantValueForCode(variant: VarianteTiendaDetalle, code: string): string {
  const normalizedCode = normalizeAttributeCode(code)
  const attrs = variant.atributos ?? {}
  if (normalizedCode in attrs) return attrs[normalizedCode] ?? ''
  if (normalizedCode === 'color') return variant.color ?? ''
  return ''
}

function buildVariantAttributes(
  producto: ProductoDetalle,
): Array<{ code: string; label: string; options: string[] }> {
  const attrsFromApi = producto.atributos_disponibles ?? []
  const attrsByCode = new Map<
    string,
    { code: string; label: string; options: Set<string> }
  >()

  for (const attr of attrsFromApi) {
    const code = normalizeAttributeCode(attr.code)
    attrsByCode.set(code, {
      code,
      label: attr.label,
      options: new Set(attr.options ?? []),
    })
  }

  const colores = Array.from(
    new Set(
      (producto.variantes_tienda ?? [])
        .map((v) => (v.color ?? '').trim())
        .filter((v) => v.length > 0),
    ),
  )

  if (colores.length > 0) {
    const colorAttr = attrsByCode.get('color') ?? {
      code: 'color',
      label: 'Color',
      options: new Set<string>(),
    }
    for (const color of colores) {
      colorAttr.options.add(color)
    }
    attrsByCode.set('color', colorAttr)
  }

  if (attrsByCode.size === 0) return []
  return Array.from(attrsByCode.values())
    .map((attr) => ({
      code: attr.code,
      label: attr.label,
      options: Array.from(attr.options),
    }))
    .filter((attr) => attr.options.length > 0)
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
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({})

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
        const firstVar = data.variantes_tienda?.[0]
        const normalizedInitialAttributes = Object.fromEntries(
          Object.entries(firstVar?.atributos ?? {}).map(([key, value]) => [normalizeAttributeCode(key), value]),
        )
        setSelectedAttributes(normalizedInitialAttributes)
        setShowUsdPrice(false)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'No se pudo cargar el detalle del producto')
      } finally {
        if (alive) {
          setLoading(false)
        }
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
    if (!producto || !variantForCart || !canAddToCart) return
    setAdding(true)
    setFeedback(null)
    try {
      const productoTarget = variantForCart.id_producto
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

  const isAccesorio = useMemo(
    () => producto?.tipo_producto === 'accesorio' || !!producto?.detalle_accesorio,
    [producto],
  )

  const variantAttributes = useMemo(
    () => (producto ? buildVariantAttributes(producto) : []),
    [producto],
  )
  const variants = useMemo(() => producto?.variantes_tienda ?? [], [producto])
  const requiredAttributeCodes = useMemo(
    () => variantAttributes.map((a) => a.code),
    [variantAttributes],
  )
  const hasAllRequiredAttributes = useMemo(
    () =>
      requiredAttributeCodes.every((code) => {
        const value = selectedAttributes[code]
        return typeof value === 'string' && value.trim().length > 0
      }),
    [requiredAttributeCodes, selectedAttributes],
  )
  const variantForCart = useMemo(() => {
    if (!producto) return null
    // Accesorios: el stock vive en `productos.stock`, no hay variantes/IMEI.
    if (isAccesorio && variants.length === 0) {
      const st = Number(producto.stock ?? 0)
      return {
        id_producto: producto.id,
        precio: producto.precio,
        stock: st,
        foto_url: producto.foto_url ?? null,
        color: null,
        atributos: {} as Record<string, string>,
      } as VarianteTiendaDetalle
    }
    if (variants.length === 0) return null
    if (requiredAttributeCodes.length === 0) {
      return variants[0] ?? null
    }
    if (!hasAllRequiredAttributes) return null
    return (
      variants.find((variant) =>
        requiredAttributeCodes.every(
          (code) =>
            normalizeSpecValue(variantValueForCode(variant, code)) === normalizeSpecValue(selectedAttributes[code]),
        ),
      ) ?? null
    )
  }, [producto, isAccesorio, variants, requiredAttributeCodes, hasAllRequiredAttributes, selectedAttributes])
  const outOfStockForSelection =
    hasAllRequiredAttributes &&
    (!variantForCart || (variantForCart.stock ?? 0) === 0)
  const canAddToCart =
    !!producto?.activo &&
    !outOfStockForSelection &&
    (variantForCart ? (variantForCart.stock ?? 0) > 0 : !producto?.variantes_tienda || producto.variantes_tienda.length === 0)
  const precioArsNumber =
    (() => {
      if (!producto) return Number.NaN
      const precio = variantForCart?.precio ?? producto.precio
      return typeof precio === 'string' ? Number(precio) : precio
    })()
  const precioUsdConvertido =
    Number.isFinite(precioArsNumber) && dolarRate && dolarRate > 0
      ? precioArsNumber / dolarRate
      : null
  const fotoActiva = variantForCart?.foto_url ?? producto?.detalle_equipo?.foto_url ?? null
  const missingAttributeLabel = variantAttributes.find((attr) => !selectedAttributes[attr.code])?.label ?? null

  const optionEnabled = (code: string, option: string) => {
    const normalizedCode = normalizeAttributeCode(code)
    const currentSelection = { ...selectedAttributes, [normalizedCode]: option }
    return variants.some((variant) =>
      variantAttributes.every((attr) => {
        const expected = currentSelection[normalizeAttributeCode(attr.code)]
        if (!expected) return true
        return normalizeSpecValue(variantValueForCode(variant, attr.code)) === normalizeSpecValue(expected)
      }),
    )
  }

  const optionAvailability = (code: string, option: string) => {
    const normalizedCode = normalizeAttributeCode(code)
    const currentSelection = { ...selectedAttributes, [normalizedCode]: option }
    const match = variants.find((variant) =>
      variantAttributes.every((attr) => {
        const expected = currentSelection[normalizeAttributeCode(attr.code)]
        if (!expected) return true
        return normalizeSpecValue(variantValueForCode(variant, attr.code)) === normalizeSpecValue(expected)
      }),
    )
    return match ? ((match.stock ?? 0) > 0 ? 'available' : 'out' ) : 'missing'
  }

  const applyOptionSelection = (code: string, option: string) => {
    setSelectedAttributes((prev) => ({ ...prev, [code]: option }))
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
            <h1 className="mb-3 text-3xl font-black tracking-tight text-gray-900">
              {tituloFamilia(producto.detalle_equipo?.nombre_modelo ?? producto.nombre)}
            </h1>
            {variantAttributes.length > 0 ? (
              <div className="mb-6 space-y-4">
                {variantAttributes.map((attr) => (
                  <div key={attr.code}>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-gray-600 uppercase">{attr.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {attr.options.map((option) => {
                        const selected =
                          normalizeSpecValue(selectedAttributes[attr.code]) === normalizeSpecValue(option)
                        const enabled = optionEnabled(attr.code, option)
                        const availability = optionAvailability(attr.code, option)
                        const selectedValue = selectedAttributes[attr.code]
                        const selectedNormalized = normalizeSpecValue(selectedValue)
                        const optionNormalized = normalizeSpecValue(option)
                        const clashesWithCurrent =
                          selectedValue &&
                          selectedNormalized !== optionNormalized &&
                          !variants.some((variant) =>
                            requiredAttributeCodes.every((attrCode) => {
                              const expected =
                                attrCode === attr.code
                                  ? option
                                  : selectedAttributes[attrCode]
                              if (!expected) return true
                              const vv =
                                variant.atributos?.[attrCode] ??
                                (attrCode === 'color' ? variant.color : undefined)
                              return normalizeSpecValue(vv) === normalizeSpecValue(expected)
                            }),
                          )
                        return (
                          <button
                            key={`${attr.code}-${option}`}
                            type="button"
                            onClick={() => applyOptionSelection(attr.code, option)}
                            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                              selected
                                ? 'border-gray-900 bg-gray-900 text-white'
                                : availability === 'available'
                                  ? 'border-gray-300 bg-white text-gray-800 hover:border-gray-500'
                                  : availability === 'out'
                                    ? 'border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-400'
                                    : 'border-gray-200 bg-gray-100 text-gray-400'
                            }`}
                          >
                            {option}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
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
                : money(variantForCart?.precio ?? producto.precio)}
            </p>
            {variantForCart && (variantForCart.stock ?? 0) > 0 ? (
              <p className="mb-3 text-xs text-gray-500">
                Variante seleccionada · Stock: {variantForCart.stock}
              </p>
            ) : null}
            {variantAttributes.length > 0 && missingAttributeLabel ? (
              <p className="mb-3 text-xs text-amber-700">Seleccioná {missingAttributeLabel} para continuar.</p>
            ) : null}
            {outOfStockForSelection ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-800">Sin stock disponible</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Este modelo / variación no se encuentra disponible en stock actualmente.
                  Podés consultarnos y avisarte cuando esté disponible.
                </p>
              </div>
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
                    <dd>{variantForCart?.color ?? producto.detalle_equipo.color ?? '-'}</dd>
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

            {producto.activo && canAddToCart ? (
              <button
                type="button"
                onClick={() => { void handleAddToCart() }}
                disabled={adding}
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition-colors duration-150 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adding ? 'Agregando...' : 'Agregar al carrito'}
              </button>
            ) : null}
            {(!producto.activo || outOfStockForSelection) && !canAddToCart ? (
              <button
                type="button"
                onClick={handleConsultAvailability}
                className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-gray-950 transition-colors duration-150 hover:bg-emerald-300"
              >
                Consultar disponibilidad por WhatsApp
              </button>
            ) : null}
            {producto.activo && !outOfStockForSelection && !canAddToCart && !missingAttributeLabel ? (
              <button
                type="button"
                disabled
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-900 opacity-50 cursor-not-allowed"
              >
                No disponible
              </button>
            ) : null}

            {feedback && <p className="mt-3 text-sm text-emerald-200">{feedback}</p>}
          </aside>
        </div>
      )}
    </section>
  )
}
