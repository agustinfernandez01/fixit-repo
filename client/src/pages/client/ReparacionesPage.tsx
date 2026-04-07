import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link, useSearchParams } from 'react-router-dom'
import type { CategoriaListaSlug, ListaPrecioReparacion, TipoReparacion } from '../../types/reparaciones'
import { reparacionesApi } from '../../services/reparacionesApi'

const STORAGE_KEY = 'fixit_reparacion_tipo_id'

const LISTA_CATEGORIAS: {
  id: CategoriaListaSlug
  label: string
  descripcion: string
}[] = [
  {
    id: 'modulo_pantalla',
    label: 'Módulo (pantalla)',
    descripcion: 'Original y calidad alternativa',
  },
  { id: 'bateria', label: 'Batería', descripcion: 'Reemplazo de batería' },
  { id: 'camara_principal', label: 'Cámara principal', descripcion: 'Cámara trasera' },
  { id: 'flex_carga', label: 'Flex de carga', descripcion: 'Puerto de carga' },
]

const CATEGORIA_SLUGS = new Set<string>(LISTA_CATEGORIAS.map((c) => c.id))

function parseServicioParam(raw: string | null): CategoriaListaSlug | null {
  if (!raw) return null
  const t = raw.trim().toLowerCase()
  return CATEGORIA_SLUGS.has(t) ? (t as CategoriaListaSlug) : null
}

function parseMonedaParam(raw: string | null): 'usd' | 'ars' | null {
  if (raw === 'usd' || raw === 'ars') return raw
  return null
}

function formatArs(value: string | null | undefined): string {
  if (!value) return ''
  const n = Number.parseFloat(value)
  if (!Number.isFinite(n)) return value
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

function formatUsd(value: string | null | undefined): string {
  if (!value) return ''
  const n = Number.parseFloat(value)
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function formatTiempo(minutos: number | null | undefined): string {
  if (!minutos) return ''
  if (minutos < 60) return `${minutos} min`
  const h = Math.round((minutos / 60) * 10) / 10
  return `${h} h`
}

function cellPrice(
  usd: string | null | undefined,
  ars: string | null | undefined,
  mode: 'usd' | 'ars',
): string {
  if (mode === 'usd') {
    if (usd != null && usd !== '') return formatUsd(usd)
    return ''
  }
  if (ars != null && ars !== '') return formatArs(ars)
  return ''
}

function isEmpty(
  usd: string | null | undefined,
  ars: string | null | undefined,
  mode: 'usd' | 'ars',
): boolean {
  return !cellPrice(usd, ars, mode)
}

const easeOut = [0.22, 1, 0.36, 1] as const

const heroContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.04 },
  },
}

const heroItem = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: easeOut },
  },
}

export default function ReparacionesPage() {
  const reduceMotion = useReducedMotion()
  const preciosRef = useRef<HTMLDivElement>(null)
  const tiposRef = useRef<HTMLDivElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const [items, setItems] = useState<TipoReparacion[] | null>(null)
  const [listaPrecios, setListaPrecios] = useState<ListaPrecioReparacion[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorTipos, setErrorTipos] = useState<string | null>(null)
  const [errorLista, setErrorLista] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [listaQuery, setListaQuery] = useState('')
  const [listaCategoria, setListaCategoria] = useState<CategoriaListaSlug>('modulo_pantalla')
  const [currency, setCurrency] = useState<'usd' | 'ars'>('ars')
  /** Acordeón abierto (null = todos cerrados) */
  const [openAccordion, setOpenAccordion] = useState<CategoriaListaSlug | null>('modulo_pantalla')
  const [masTemasOpen, setMasTemasOpen] = useState(false)

  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? n : null
  })

  const filtered = useMemo(() => {
    const list = items ?? []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((x) => {
      const text = `${x.nombre ?? ''} ${x.descripcion ?? ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [items, query])

  const selected = useMemo(
    () => items?.find((x) => x.id_tipo_reparacion === selectedId) ?? null,
    [items, selectedId],
  )

  /** Filas por categoría (acordeón) */
  const rowsPorCategoria = useMemo(() => {
    const list = listaPrecios ?? []
    const q = listaQuery.trim().toLowerCase()
    const filt = (cat: CategoriaListaSlug) =>
      list
        .filter((x) => x.categoria === cat)
        .filter((x) => (q ? x.modelo.toLowerCase().includes(q) : true))
        .sort((a, b) => a.orden - b.orden || a.modelo.localeCompare(b.modelo))
    return {
      modulo_pantalla: filt('modulo_pantalla'),
      bateria: filt('bateria'),
      camara_principal: filt('camara_principal'),
      flex_carga: filt('flex_carga'),
    }
  }, [listaPrecios, listaQuery])

  /** Lee ?servicio= y ?moneda= para enlaces compartibles (ej. /reparaciones?servicio=bateria&moneda=usd) */
  useEffect(() => {
    const cat = parseServicioParam(searchParams.get('servicio'))
    if (cat) {
      setListaCategoria(cat)
      setOpenAccordion(cat)
    }
    const m = parseMonedaParam(searchParams.get('moneda'))
    if (m) setCurrency(m)
  }, [searchParams])

  function applyPreciosParams(patch: { servicio?: CategoriaListaSlug; moneda?: 'usd' | 'ars' }) {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        if (patch.servicio !== undefined) n.set('servicio', patch.servicio)
        if (patch.moneda !== undefined) n.set('moneda', patch.moneda)
        return n
      },
      { replace: true },
    )
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setErrorTipos(null)
      setErrorLista(null)
      const [rTipos, rLista] = await Promise.allSettled([
        reparacionesApi.tipos.list(0, 100),
        reparacionesApi.listaPrecios.list(),
      ])
      if (!alive) return
      if (rTipos.status === 'fulfilled') setItems(rTipos.value)
      else
        setErrorTipos(
          rTipos.reason instanceof Error ? rTipos.reason.message : 'No se pudieron cargar los tipos',
        )
      if (rLista.status === 'fulfilled') setListaPrecios(rLista.value)
      else
        setErrorLista(
          rLista.reason instanceof Error ? rLista.reason.message : 'No se pudo cargar la lista de precios',
        )
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [])

  function choose(id: number) {
    if (selectedId === id) {
      setSelectedId(null)
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    setSelectedId(id)
    localStorage.setItem(STORAGE_KEY, String(id))
  }

  function irAPrecios(cat: CategoriaListaSlug) {
    setListaCategoria(cat)
    setListaQuery('')
    setOpenAccordion(cat)
    applyPreciosParams({ servicio: cat })
    preciosRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function abrirMasTemas(opts?: { query?: string; scroll?: boolean }) {
    if (opts?.query !== undefined) setQuery(opts.query)
    setMasTemasOpen(true)
    if (opts?.scroll) {
      window.setTimeout(() => tiposRef.current?.scrollIntoView({ behavior: 'smooth' }), 120)
    }
  }

  const tap = reduceMotion ? {} : { whileTap: { scale: 0.98 } }
  const hoverCard = reduceMotion ? {} : { whileHover: { y: -3, transition: { duration: 0.2 } } }

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-5xl px-6 py-8">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          variants={reduceMotion ? undefined : heroContainer}
          initial={reduceMotion ? false : 'hidden'}
          animate={reduceMotion ? undefined : 'visible'}
        >
          <motion.div
            variants={reduceMotion ? undefined : heroItem}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 shadow-lg shadow-blue-500/25"
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-white" fill="currentColor">
              <path d="M12 2a7 7 0 0 0-4 12.74V17a2 2 0 0 0 2 2h1v-2h-1v-2.6a1 1 0 0 0-.5-.86A5 5 0 1 1 17.5 13.54a1 1 0 0 0-.5.86V17h-1v2h1a2 2 0 0 0 2-2v-2.26A7 7 0 0 0 12 2zm-1 19h2v1a1 1 0 0 1-2 0v-1z" />
            </svg>
          </motion.div>
          <motion.h1
            variants={reduceMotion ? undefined : heroItem}
            className="mt-6 text-4xl font-black tracking-tight text-gray-900 sm:text-5xl"
          >
            Soporte técnico de Fix It
          </motion.h1>
          <motion.p
            variants={reduceMotion ? undefined : heroItem}
            className="mt-3 text-base leading-relaxed text-gray-400"
          >
            ¿Necesitás ayuda? Comenzá aquí.
          </motion.p>
        </motion.div>

        <div className="mt-8">
          <motion.h2
            className="text-center text-2xl font-extrabold tracking-tight text-gray-900"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.35, ease: easeOut }}
          >
            Herramientas de soporte técnico
          </motion.h2>
          <div className="mx-auto mt-5 flex max-w-2xl flex-col gap-4 sm:flex-row sm:justify-center sm:gap-6">
            <motion.button
              type="button"
              onClick={() => irAPrecios('modulo_pantalla')}
              className="flex-1 rounded-2xl border border-gray-100 bg-gray-50 px-6 py-5 text-center shadow-sm transition hover:border-gray-200 hover:bg-white"
              {...hoverCard}
              {...tap}
            >
              <p className="text-sm font-medium text-blue-700">Cambio de pantalla</p>
              <p className="mt-1 text-xs text-gray-400">Ver precios por modelo</p>
            </motion.button>
            <motion.button
              type="button"
              onClick={() => irAPrecios('bateria')}
              className="flex-1 rounded-2xl border border-gray-100 bg-gray-50 px-6 py-5 text-center shadow-sm transition hover:border-gray-200 hover:bg-white"
              {...hoverCard}
              {...tap}
            >
              <p className="text-sm font-medium text-blue-700">Cambio de batería</p>
              <p className="mt-1 text-xs text-gray-400">Ver precios por modelo</p>
            </motion.button>
          </div>
          <p className="mt-4 text-center">
            <motion.button
              type="button"
              onClick={() => abrirMasTemas({ query: 'carcaza', scroll: true })}
              className="text-sm font-medium text-blue-700 underline-offset-4 hover:underline"
              {...tap}
            >
              Carcaza y otros servicios
            </motion.button>
          </p>
        </div>

        {/* ——— Lista de precios por modelo (DB lista_precios_reparacion) ——— */}
        <div id="precios-por-modelo" ref={preciosRef} className="mt-10 scroll-mt-20">
          <motion.h2
            className="text-center text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOut }}
          >
            Buscá tu iPhone
          </motion.h2>

          {loading ? (
            <p className="mt-6 text-center text-sm text-gray-500">Cargando precios…</p>
          ) : null}
          {errorLista ? (
            <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {errorLista}
            </div>
          ) : null}

          {!loading && !errorLista && (listaPrecios?.length ?? 0) === 0 ? (
            <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-center text-sm text-gray-600">
              No hay precios cargados. Ejecutá el seed en el backend si aún no lo hiciste.
            </div>
          ) : null}

          {!loading && !errorLista && (listaPrecios?.length ?? 0) > 0 ? (
            <>
              <motion.div
                className="mx-auto mt-6 flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: easeOut }}
              >
                <div
                  role="tablist"
                  aria-label="Tipo de servicio"
                  className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {LISTA_CATEGORIAS.map((c) => {
                    const on = c.id === listaCategoria
                    return (
                      <motion.button
                        key={c.id}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => {
                          setListaCategoria(c.id)
                          setOpenAccordion(c.id)
                          applyPreciosParams({ servicio: c.id })
                        }}
                        className={[
                          'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition',
                          on
                            ? 'bg-blue-500 text-white shadow-sm'
                            : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                        ].join(' ')}
                        {...(reduceMotion ? {} : { whileTap: { scale: 0.97 }} )}
                      >
                        {c.label}
                      </motion.button>
                    )
                  })}
                </div>
                <div
                  className="flex shrink-0 rounded-2xl border border-gray-200 bg-gray-50 p-1 text-sm"
                  role="group"
                  aria-label="Moneda"
                >
                  <motion.button
                    type="button"
                    onClick={() => {
                      setCurrency('ars')
                      applyPreciosParams({ moneda: 'ars' })
                    }}
                    className={[
                      'rounded-xl px-4 py-2 font-medium transition',
                      currency === 'ars' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
                    ].join(' ')}
                    {...(reduceMotion ? {} : { whileTap: { scale: 0.97 }} )}
                  >
                    Pesos
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => {
                      setCurrency('usd')
                      applyPreciosParams({ moneda: 'usd' })
                    }}
                    className={[
                      'rounded-xl px-4 py-2 font-medium transition',
                      currency === 'usd' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
                    ].join(' ')}
                    {...(reduceMotion ? {} : { whileTap: { scale: 0.97 }} )}
                  >
                    USD
                  </motion.button>
                </div>
              </motion.div>

              <div className="mx-auto mt-4 max-w-3xl">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-300">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                      <path d="M10 2a8 8 0 1 1 5.293 14.01l4.348 4.349-1.414 1.414-4.349-4.348A8 8 0 0 1 10 2zm0 2a6 6 0 1 0 0 12a6 6 0 0 0 0-12z" />
                    </svg>
                  </div>
                  <input
                    value={listaQuery}
                    onChange={(e) => setListaQuery(e.target.value)}
                    placeholder="Buscar modelo (ej. 14 Pro, mini…)"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-12 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                  {LISTA_CATEGORIAS.map((cat) => {
                    const rows = rowsPorCategoria[cat.id]
                    const open = openAccordion === cat.id
                    return (
                      <motion.div
                        key={cat.id}
                        layout
                        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                        transition={{ layout: { duration: reduceMotion ? 0 : 0.25, ease: easeOut } }}
                      >
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-label={`${cat.label}: ${rows.length} modelos`}
                          onClick={() => {
                            if (open) {
                              setOpenAccordion(null)
                            } else {
                              setListaCategoria(cat.id)
                              setOpenAccordion(cat.id)
                              applyPreciosParams({ servicio: cat.id })
                            }
                          }}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
                        >
                          <span className="font-medium text-gray-900">{rows.length} modelos</span>
                          <motion.svg
                            className="h-5 w-5 shrink-0 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden
                            animate={{ rotate: open ? 180 : 0 }}
                            transition={{ duration: reduceMotion ? 0 : 0.22, ease: easeOut }}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </motion.svg>
                        </button>
                        <AnimatePresence initial={false}>
                          {open ? (
                            <motion.div
                              key={`${cat.id}-panel`}
                              initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
                              transition={{ duration: reduceMotion ? 0 : 0.2, ease: easeOut }}
                              className="border-t border-gray-100"
                            >
                              {cat.id === 'modulo_pantalla' ? (
                                <ListaTablaModulo rows={rows} currency={currency} />
                              ) : (
                                <ListaTablaSimple rows={rows} currency={currency} />
                              )}
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}
              </div>
            </>
          ) : null}
        </div>

        <AnimatePresence mode="wait">
          {!masTemasOpen ? (
            <motion.div
              key="mas-temas-cerrado"
              className="mt-10 text-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: easeOut }}
            >
              <motion.button
                type="button"
                onClick={() => abrirMasTemas()}
                className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 transition hover:border-gray-300"
                {...(reduceMotion ? {} : { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 } })}
              >
                Ver otros tipos de reparación
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="mas-temas-abierto"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: reduceMotion ? 0 : 0.3, ease: easeOut }}
            >
          <>
            <div id="tipos-reparacion" ref={tiposRef} className="mt-10 scroll-mt-20">
              <h2 className="text-center text-2xl font-semibold tracking-tight text-gray-900">
                Otros tipos de reparación
              </h2>
              <div className="mx-auto mt-5 max-w-3xl">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-300">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <path d="M10 2a8 8 0 1 1 5.293 14.01l4.348 4.349-1.414 1.414-4.349-4.348A8 8 0 0 1 10 2zm0 2a6 6 0 1 0 0 12a6 6 0 0 0 0-12z" />
                    </svg>
                  </div>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar en esta lista"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-12 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="mt-5 text-center text-sm text-gray-500">Cargando…</div>
            ) : null}
            {errorTipos ? (
              <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
                {errorTipos}
              </div>
            ) : null}

            {!loading && !errorTipos && (items?.length ?? 0) === 0 ? (
              <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Todavía no hay tipos cargados en esta tabla. Podés usar la lista de precios de arriba o cargar tipos en
                el backend.
              </div>
            ) : null}

            {filtered.length ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {filtered.map((it, idx) => {
                  const active = it.id_tipo_reparacion === selectedId
                  return (
                    <motion.button
                      key={it.id_tipo_reparacion}
                      type="button"
                      onClick={() => choose(it.id_tipo_reparacion)}
                      className={[
                        'text-left rounded-2xl border px-5 py-4 transition-colors',
                        active
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white hover:border-gray-400',
                      ].join(' ')}
                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      transition={{ delay: reduceMotion ? 0 : idx * 0.04, duration: 0.25, ease: easeOut }}
                      {...(reduceMotion ? {} : { whileHover: { y: -2 }, whileTap: { scale: 0.99 } })}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className={active ? 'text-xs text-gray-300' : 'text-xs text-gray-400'}>
                            Tipo de reparación
                          </p>
                          <p className="mt-1 text-base font-semibold">{it.nombre}</p>
                          {it.descripcion ? (
                            <p className={active ? 'mt-2 text-sm text-gray-200' : 'mt-2 text-sm text-gray-500'}>
                              {it.descripcion}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          {it.precio_base ? (
                            <p className="text-sm font-semibold">{formatArs(it.precio_base)}</p>
                          ) : (
                            <p className={active ? 'text-sm text-gray-300' : 'text-sm text-gray-400'}>
                              Consultar
                            </p>
                          )}
                          {it.tiempo_estimado ? (
                            <p className={active ? 'mt-1 text-xs text-gray-300' : 'mt-1 text-xs text-gray-400'}>
                              {formatTiempo(it.tiempo_estimado)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            ) : !loading && !errorTipos && (items?.length ?? 0) > 0 && query.trim() ? (
              <p className="mt-6 text-center text-sm text-gray-500">
                No hay resultados para <span className="font-medium text-gray-800">{query.trim()}</span>.
              </p>
            ) : null}

            <div className="mt-6 text-center">
              <motion.button
                type="button"
                onClick={() => setMasTemasOpen(false)}
                className="text-sm text-gray-500 underline-offset-4 hover:text-gray-800 hover:underline"
                {...tap}
              >
                Ocultar esta sección
              </motion.button>
            </div>
          </>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-500">
            {selected ? (
              <>
                Seleccionado: <span className="font-medium text-gray-900">{selected.nombre}</span>
              </>
            ) : (
              'Seleccioná un arreglo para continuar.'
            )}
          </div>
          <motion.div {...(reduceMotion ? {} : { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 } })}>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-full border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-900 hover:border-gray-400"
            >
              Volver
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

function ListaTablaModulo({
  rows,
  currency,
}: {
  rows: ListaPrecioReparacion[]
  currency: 'usd' | 'ars'
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
            <th className="px-4 py-2 font-medium">Modelo</th>
            <th className="px-4 py-2 font-medium text-blue-700">Original</th>
            <th className="px-4 py-2 font-medium text-gray-600">Alternativa</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => {
            const o = cellPrice(row.precio_usd_original, row.precio_ars_original, currency)
            const a = cellPrice(row.precio_usd_alternativo, row.precio_ars_alternativo, currency)
            const oe = isEmpty(row.precio_usd_original, row.precio_ars_original, currency)
            const ae = isEmpty(row.precio_usd_alternativo, row.precio_ars_alternativo, currency)
            const allEmpty = oe && ae
            return (
              <tr key={row.id_lista_precio} className="hover:bg-gray-50/80">
                <td className="px-4 py-2 font-medium text-gray-900">{row.modelo}</td>
                <td className="px-4 py-2 tabular-nums text-gray-800">
                  {allEmpty ? (
                    <span className="text-gray-400">Consultar</span>
                  ) : oe ? (
                    <span className="text-gray-300">—</span>
                  ) : (
                    o
                  )}
                </td>
                <td className="px-4 py-2 tabular-nums text-gray-800">
                  {allEmpty ? (
                    <span className="text-gray-400">Consultar</span>
                  ) : ae ? (
                    <span className="text-gray-300">—</span>
                  ) : (
                    a
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-gray-500">Ningún modelo coincide con la búsqueda.</p>
      ) : null}
    </div>
  )
}

function ListaTablaSimple({
  rows,
  currency,
}: {
  rows: ListaPrecioReparacion[]
  currency: 'usd' | 'ars'
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[280px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
            <th className="px-4 py-2 font-medium">Modelo</th>
            <th className="px-4 py-2 text-right font-medium">Precio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => {
            const p = cellPrice(row.precio_usd_original, row.precio_ars_original, currency)
            const empty = isEmpty(row.precio_usd_original, row.precio_ars_original, currency)
            return (
              <tr key={row.id_lista_precio} className="hover:bg-gray-50/80">
                <td className="px-4 py-2 font-medium text-gray-900">{row.modelo}</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-900">
                  {empty ? <span className="font-normal text-gray-400">Consultar</span> : p}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-gray-500">Ningún modelo coincide con la búsqueda.</p>
      ) : null}
    </div>
  )
}
