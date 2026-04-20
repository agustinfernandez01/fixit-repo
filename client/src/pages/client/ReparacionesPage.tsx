import { useEffect, useMemo, useRef, useState } from 'react'
import type { CategoriaListaSlug, ListaPrecioReparacion, TipoReparacion } from '../../types/reparaciones'
import { carritoApi } from '../../services/carritoApi'
import { reparacionesApi } from '../../services/reparacionesApi'

const WHATSAPP_PHONE: string = import.meta.env.VITE_WHATSAPP_CHECKOUT_PHONE ?? ''

type ProblemaOption = {
  id: string
  label: string
  /** Texto “hint” para encontrar un `TipoReparacion` por nombre. */
  hint: string
}

const PROBLEMAS: ProblemaOption[] = [
  { id: 'no-encontre', label: 'No encontré mi problema', hint: '' },
  { id: 'bateria', label: 'Batería / Carga lenta', hint: 'bater' },
  { id: 'vidrio-trasero', label: 'Cambio de tapas traseras', hint: 'tapa' },
  { id: 'pin-carga', label: 'Pin de carga / No carga', hint: 'carga' },
  { id: 'camara-parlante-mic', label: 'Cambio de cámara principal', hint: 'cam' },
]

function normalizePhoneForWaMe(phone: string): string {
  return (phone || '').replace(/[^\d]/g, '')
}

function buildWhatsAppUrl(phoneRaw: string, text: string): string | null {
  const phone = normalizePhoneForWaMe(phoneRaw)
  if (!phone) return null
  const msg = encodeURIComponent(text)
  return `https://wa.me/${phone}?text=${msg}`
}

function findTipoByHint(items: TipoReparacion[], hint: string): TipoReparacion | null {
  const h = hint.trim().toLowerCase()
  if (!h) return null
  return items.find((x) => (x.nombre ?? '').toLowerCase().includes(h)) ?? null
}

type ReparacionModelo = {
  id: number
  nombre_modelo: string
}

function buildModeloLabel(m: ReparacionModelo): string {
  return m.nombre_modelo
}

export default function ReparacionesPage() {
  const topRef = useRef<HTMLDivElement | null>(null)

  const [tipos, setTipos] = useState<TipoReparacion[]>([])
  const [modelos, setModelos] = useState<ReparacionModelo[]>([])
  const [listaPrecios, setListaPrecios] = useState<ListaPrecioReparacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null)

  const [modeloOpen, setModeloOpen] = useState(false)
  const [modeloQuery, setModeloQuery] = useState('')
  const [modeloSelectedId, setModeloSelectedId] = useState<number | null>(null)

  const [problemaOpen, setProblemaOpen] = useState(false)
  const [problemaSelectedId, setProblemaSelectedId] = useState<string | null>(PROBLEMAS[2]?.id ?? null)
  const [problemaDetalle, setProblemaDetalle] = useState('')

  const modeloSelected = useMemo(
    () => modelos.find((m) => m.id === modeloSelectedId) ?? null,
    [modelos, modeloSelectedId],
  )

  const modelosFiltered = useMemo(() => {
    const q = modeloQuery.trim().toLowerCase()
    if (!q) return modelos
    return modelos.filter((m) => buildModeloLabel(m).toLowerCase().includes(q))
  }, [modelos, modeloQuery])

  const problemaSelected = useMemo(
    () => PROBLEMAS.find((p) => p.id === problemaSelectedId) ?? null,
    [problemaSelectedId],
  )

  const tipoSelected = useMemo(() => {
    if (!problemaSelected) return null
    return findTipoByHint(tipos, problemaSelected.hint)
  }, [tipos, problemaSelected])

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [tiposData, listaData] = await Promise.all([
          reparacionesApi.tipos.list(0, 100),
          reparacionesApi.listaPrecios.list(),
        ])
        if (!alive) return
        setTipos(tiposData)
        // Siempre tomamos modelos "precargados" desde la lista de precios,
        // para que la cotización coincida con los precios definidos.
        const seen = new Set<string>()
        const derived: ReparacionModelo[] = listaData
          .slice()
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
          .map((x) => (x.modelo ?? '').trim())
          .filter((x) => {
            const key = x.toUpperCase()
            if (!key) return false
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          .map((nombre_modelo, idx) => ({
            id: idx + 1,
            nombre_modelo,
          }))
        setModelos(derived)
        setListaPrecios(listaData)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'No se pudo cargar')
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  const categoriaPrecio: CategoriaListaSlug | null = useMemo(() => {
    switch (problemaSelectedId) {
      case 'bateria':
        return 'bateria'
      case 'pin-carga':
        return 'flex_carga'
      case 'camara-parlante-mic':
        return 'camara_principal'
      case 'vidrio-trasero':
        return 'tapas_traseras'
      default:
        return null
    }
  }, [problemaSelectedId])

  const canWhatsApp = Boolean(WHATSAPP_PHONE) && problemaSelectedId === 'no-encontre'

  function normalizeModelForPriceLookup(input: string): string {
    return (input || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim()
  }

  const precioSelected = useMemo(() => {
    if (!categoriaPrecio || !modeloSelected) return null
    const wanted = normalizeModelForPriceLookup(modeloSelected.nombre_modelo)
    const rows = listaPrecios.filter((r) => r.categoria === categoriaPrecio)
    // match directo por contención (por diferencias como "12/12 PRO", "XR/SE 2nd GEN", etc.)
    return (
      rows.find((r) => normalizeModelForPriceLookup(r.modelo) === wanted) ??
      rows.find((r) => normalizeModelForPriceLookup(r.modelo).includes(wanted)) ??
      rows.find((r) => wanted.includes(normalizeModelForPriceLookup(r.modelo))) ??
      null
    )
  }, [categoriaPrecio, listaPrecios, modeloSelected])

  const precioArs = precioSelected?.precio_ars_original ? Number(precioSelected.precio_ars_original) : null
  const precioUsd = precioSelected?.precio_usd_original ? Number(precioSelected.precio_usd_original) : null

  async function handleAddRepairToCart() {
    if (!categoriaPrecio || !precioSelected || !modeloSelected) return
    setAdding(true)
    setAddedFeedback(null)
    try {
      const producto = await reparacionesApi.carritoProducto.create({
        categoria: categoriaPrecio,
        modelo: precioSelected.modelo,
      })
      await carritoApi.ensure(false)
      await carritoApi.addItem(producto.id_producto, 1, false)
      setAddedFeedback('Agregado al carrito.')
    } catch (e) {
      setAddedFeedback(e instanceof Error ? e.message : 'No se pudo agregar al carrito.')
    } finally {
      setAdding(false)
    }
  }

  const whatsAppHref = useMemo(() => {
    if (!canWhatsApp) return null
    const modelo = modeloSelected ? buildModeloLabel(modeloSelected) : null
    const problema = problemaSelected?.label ?? null
    const tipo = tipoSelected?.nombre ?? null
    const extra = tipo && problema && tipo.toLowerCase() !== problema.toLowerCase() ? ` (ref: ${tipo})` : ''
    const detalle = problemaDetalle.trim()
    const textLines = [
      'Hola Fix It 👋',
      'Quiero cotizar una reparación.',
      modelo ? `Modelo: ${modelo}` : 'Modelo: (sin seleccionar)',
      problema ? `Problema: ${problema}${extra}` : 'Problema: (sin seleccionar)',
      detalle ? `Detalle: ${detalle}` : null,
    ]
      .filter(Boolean) as string[]
    return buildWhatsAppUrl(WHATSAPP_PHONE, textLines.join('\n'))
  }, [canWhatsApp, modeloSelected, problemaSelected, tipoSelected, problemaDetalle])

  function quickPickProblema(id: string) {
    setProblemaSelectedId(id)
    setProblemaOpen(false)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="bg-[#f7f9fb]">
      <div ref={topRef} />

      <section className="mx-auto max-w-5xl px-6 pt-10 pb-14">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black tracking-tight text-neutral-900 sm:text-5xl">
            Servicio técnico Fix It
          </h1>
        </div>

        <div className="mx-auto max-w-xl rounded-3xl border border-neutral-200 bg-white px-5 py-7 shadow-sm sm:px-7">
          <h1 className="text-center text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
            Cotizá tu reparación
          </h1>

          <div className="mt-7 space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-900">¿Qué modelo tenés?</p>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setModeloOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none transition hover:border-neutral-300"
                >
                  <span className={modeloSelected ? 'text-neutral-900' : 'text-neutral-400'}>
                    {modeloSelected ? buildModeloLabel(modeloSelected) : 'Seleccioná tu modelo'}
                  </span>
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {modeloOpen ? (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg">
                    <div className="p-3">
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                            <path d="M10 2a8 8 0 1 1 5.293 14.01l4.348 4.349-1.414 1.414-4.349-4.348A8 8 0 0 1 10 2zm0 2a6 6 0 1 0 0 12a6 6 0 0 0 0-12z" />
                          </svg>
                        </div>
                        <input
                          value={modeloQuery}
                          onChange={(e) => setModeloQuery(e.target.value)}
                          placeholder="Buscar modelo…"
                          className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pr-3 pl-10 text-sm text-neutral-900 outline-none focus:border-neutral-400"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-auto py-1">
                      {loading ? (
                        <div className="px-4 py-3 text-sm text-neutral-500">Cargando…</div>
                      ) : modelosFiltered.length ? (
                        modelosFiltered.map((m) => {
                          const active = m.id === modeloSelectedId
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setModeloSelectedId(m.id ?? null)
                                setModeloOpen(false)
                                setModeloQuery('')
                              }}
                              className={[
                                'flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition',
                                active ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-neutral-50 text-neutral-800',
                              ].join(' ')}
                            >
                              <span>{buildModeloLabel(m)}</span>
                              {active ? (
                                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
                                </svg>
                              ) : null}
                            </button>
                          )
                        })
                      ) : (
                        <div className="px-4 py-3 text-sm text-neutral-500">No hay resultados.</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-900">¿Cuál es el problema?</p>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProblemaOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none transition hover:border-neutral-300"
                >
                  <span className={problemaSelected ? 'text-neutral-900' : 'text-neutral-400'}>
                    {problemaSelected ? problemaSelected.label : 'Seleccioná el problema'}
                  </span>
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {problemaOpen ? (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg">
                    <div className="max-h-72 overflow-auto py-1">
                      {PROBLEMAS.map((p, idx) => {
                        const active = p.id === problemaSelectedId
                        const isFallback = p.id === 'no-encontre'
                        return (
                          <div key={p.id}>
                            {idx === 1 ? <div className="my-1 border-t border-neutral-100" /> : null}
                            <button
                              type="button"
                              onClick={() => {
                                setProblemaSelectedId(p.id)
                                if (p.id !== 'no-encontre') {
                                  setProblemaDetalle('')
                                }
                                setProblemaOpen(false)
                              }}
                              className={[
                                'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition',
                                active ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-neutral-50 text-neutral-800',
                                isFallback && !active ? 'bg-neutral-50/60 font-semibold text-neutral-900' : '',
                              ].join(' ')}
                            >
                              <span className="flex h-5 w-5 items-center justify-center">
                                {active ? (
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
                                  </svg>
                                ) : (
                                  <span
                                    className={[
                                      'h-2.5 w-2.5 rounded-full border',
                                      isFallback ? 'border-neutral-400' : 'border-neutral-300',
                                    ].join(' ')}
                                    aria-hidden
                                  />
                                )}
                              </span>
                              <span className="flex items-center gap-2">
                                <span>{p.label}</span>
                                {isFallback ? (
                                  <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                                    WhatsApp
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {problemaSelectedId === 'no-encontre' ? (
              <div>
                <p className="mb-2 text-sm font-medium text-neutral-900">Contanos qué te pasa</p>
                <textarea
                  value={problemaDetalle}
                  onChange={(e) => setProblemaDetalle(e.target.value)}
                  placeholder="Ej: se apaga solo, no reconoce el SIM, se calentó y quedó en logo, etc."
                  rows={4}
                  maxLength={500}
                  className="w-full resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-400"
                />
                <p className="mt-1 text-xs text-neutral-400">Máx. 500 caracteres.</p>
              </div>
            ) : null}

            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-4 py-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-wide text-emerald-800 uppercase">Presupuesto</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    {categoriaPrecio ? (
                      <>
                        {problemaSelected?.label ?? 'Reparación'} {modeloSelected ? `· ${buildModeloLabel(modeloSelected)}` : ''}
                      </>
                    ) : (
                      'Elegí un problema compatible para ver precio'
                    )}
                  </p>
                  <p className="mt-2 text-base text-neutral-900">
                    {categoriaPrecio && modeloSelected ? (
                      precioArs != null && precioUsd != null ? (
                        <>
                          <span className="text-xl font-black tracking-tight">
                            ${precioArs.toLocaleString('es-AR')}
                          </span>{' '}
                          <span className="mx-1 text-neutral-400">·</span>{' '}
                          <span className="text-sm font-semibold text-neutral-700">
                            USD {precioUsd.toLocaleString('en-US')}
                          </span>
                        </>
                      ) : (
                        <span className="text-neutral-500">Sin precio para este modelo (todavía).</span>
                      )
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!categoriaPrecio || !modeloSelected || precioArs == null || adding}
                  onClick={() => {
                    void handleAddRepairToCart()
                  }}
                  className={[
                    'shrink-0 rounded-2xl px-4 py-3 text-sm font-extrabold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2',
                    !categoriaPrecio || !modeloSelected || precioArs == null || adding
                      ? 'bg-neutral-200 text-neutral-500'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700',
                  ].join(' ')}
                >
                  {adding ? 'Agregando…' : 'Agregar al carrito'}
                </button>
              </div>

              {addedFeedback ? (
                <p className="mt-2 text-sm text-neutral-600">{addedFeedback}</p>
              ) : null}
            </div>

            <a
              href={whatsAppHref ?? undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!whatsAppHref}
              className={[
                'mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm transition',
                whatsAppHref ? 'bg-emerald-300 text-emerald-950 hover:bg-emerald-400' : 'bg-neutral-200 text-neutral-500',
              ].join(' ')}
              onClick={(e) => {
                if (!whatsAppHref) e.preventDefault()
              }}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M12.04 2C6.58 2 2.16 6.42 2.16 11.88c0 1.93.56 3.82 1.62 5.45L2 22l4.82-1.73a9.82 9.82 0 0 0 5.22 1.48h.01c5.46 0 9.88-4.42 9.88-9.88C21.93 6.42 17.5 2 12.04 2zm5.75 14.28c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.13.11-1.82-.11-.42-.13-.97-.32-1.67-.62-2.94-1.27-4.86-4.22-5-4.42-.14-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.17 1.03-2.47.27-.3.6-.38.8-.38h.58c.19 0 .45-.07.7.53.25.6.85 2.08.92 2.23.07.15.12.33.03.53-.09.2-.14.33-.28.51-.14.18-.3.4-.43.54-.14.14-.28.3-.12.58.16.28.72 1.19 1.55 1.93 1.06.95 1.95 1.25 2.23 1.39.28.14.44.12.6-.07.16-.19.69-.8.87-1.07.18-.27.37-.22.62-.13.25.09 1.6.76 1.87.9.27.14.45.2.52.31.07.11.07.66-.17 1.34z" />
              </svg>
              Consultar por WhatsApp
            </a>

            <p className="text-center text-xs text-neutral-400">
              Te respondemos en minutos
              {!WHATSAPP_PHONE ? (
                <>
                  {' '}
                  · Configurar{' '}
                  <code className="rounded bg-neutral-100 px-1 py-0.5">VITE_WHATSAPP_CHECKOUT_PHONE</code>
                </>
              ) : null}
            </p>

            {error ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-14 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">Reparaciones más comunes</h2>
          <p className="mt-2 text-sm text-neutral-500">Seleccioná un servicio para cotizar</p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex h-full flex-col rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex flex-1 items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 3h4v4h-4V3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10v14H7V7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-900">Batería</h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                  Dura poco, se apaga o carga raro. Diagnóstico y reemplazo según modelo.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-700">Repuestos premium</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">Con garantía</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => quickPickProblema('bateria')}
              className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline"
            >
              Cotizar <span aria-hidden>→</span>
            </button>
          </div>

          <div className="flex h-full flex-col rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex flex-1 items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 8h8" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-900">Tapas traseras</h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                  Cambio de tapas traseras según modelo. Te pasamos precio y disponibilidad.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-700">Presupuesto claro</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">Con garantía</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => quickPickProblema('vidrio-trasero')}
              className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline"
            >
              Cotizar <span aria-hidden>→</span>
            </button>
          </div>

          <div className="flex h-full flex-col rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex flex-1 items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v5m6-5v5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 8h8" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 12v6" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 12v6" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 10h10a1 1 0 0 1 1 1v2a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-2a1 1 0 0 1 1-1z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-900">Pin de carga</h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                  Conector flojo, no carga o no reconoce el cable. Revisamos pin, flex y más.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-700">Presupuesto claro</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => quickPickProblema('pin-carga')}
              className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline"
            >
              Cotizar <span aria-hidden>→</span>
            </button>
          </div>

          <div className="flex h-full flex-col rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex flex-1 items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 11a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 10l2-1v6l-2-1" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-900">Cámara principal</h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                  Cambio de cámara principal según modelo. Te pasamos precio y disponibilidad.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-700">Diagnóstico previo</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">Con garantía</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => quickPickProblema('camara-parlante-mic')}
              className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline"
            >
              Cotizar <span aria-hidden>→</span>
            </button>
          </div>
        </div>

        {!loading && !error && tipos.length === 0 ? (
          <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Todavía no hay reparaciones cargadas. Cargalas en el backend con{' '}
            <code className="rounded bg-white/60 px-1 py-0.5">POST /api/v1/reparaciones/tipos</code>.
          </div>
        ) : null}

        {/* WhatsApp solo se habilita desde el selector "No encontré mi problema" */}
      </section>
    </div>
  )
}

