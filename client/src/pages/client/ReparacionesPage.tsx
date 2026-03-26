import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { TipoReparacion } from '../../types/reparaciones'
import { reparacionesApi } from '../../services/reparacionesApi'

const STORAGE_KEY = 'fixit_reparacion_tipo_id'

function formatArs(value: string | null | undefined): string {
  if (!value) return ''
  const n = Number.parseFloat(value)
  if (!Number.isFinite(n)) return value
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

function formatTiempo(minutos: number | null | undefined): string {
  if (!minutos) return ''
  if (minutos < 60) return `${minutos} min`
  const h = Math.round((minutos / 60) * 10) / 10
  return `${h} h`
}

export default function ReparacionesPage() {
  const [items, setItems] = useState<TipoReparacion[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
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

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await reparacionesApi.tipos.list(0, 100)
        if (!alive) return
        setItems(data)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'No se pudo cargar')
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }
    load()
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

  function chooseByNameHint(hint: string) {
    const h = hint.toLowerCase()
    const found =
      (items ?? []).find((x) => x.nombre.toLowerCase().includes(h)) ?? null
    if (!found) {
      setQuery(hint)
      return
    }

    // Toggle: si ya estaba seleccionada, la desmarcamos y mostramos todo.
    if (selectedId === found.id_tipo_reparacion) {
      choose(found.id_tipo_reparacion)
      setQuery('')
      return
    }

    choose(found.id_tipo_reparacion)
    setQuery(hint)
  }

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-white" fill="currentColor">
              <path d="M12 2a7 7 0 0 0-4 12.74V17a2 2 0 0 0 2 2h1v-2h-1v-2.6a1 1 0 0 0-.5-.86A5 5 0 1 1 17.5 13.54a1 1 0 0 0-.5.86V17h-1v2h1a2 2 0 0 0 2-2v-2.26A7 7 0 0 0 12 2zm-1 19h2v1a1 1 0 0 1-2 0v-1z" />
            </svg>
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-gray-900 sm:text-5xl">
            Soporte técnico de Fix It
          </h1>
          <p className="mt-3 text-base leading-relaxed text-gray-400">
            ¿Necesitás ayuda? Comenzá aquí.
          </p>
        </div>

        <div className="mt-12">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-gray-900">
            Herramientas de soporte técnico
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => chooseByNameHint('pantalla')}
              className="rounded-2xl border border-gray-100 bg-gray-50 px-6 py-5 text-center shadow-sm transition hover:border-gray-200 hover:bg-white"
            >
              <p className="text-sm font-medium text-blue-700">Cambio de pantalla</p>
              <p className="mt-1 text-xs text-gray-400">Ver precio y tiempos</p>
            </button>
            <button
              type="button"
              onClick={() => chooseByNameHint('bater')}
              className="rounded-2xl border border-gray-100 bg-gray-50 px-6 py-5 text-center shadow-sm transition hover:border-gray-200 hover:bg-white"
            >
              <p className="text-sm font-medium text-blue-700">Cambio de batería</p>
              <p className="mt-1 text-xs text-gray-400">Ver precio y tiempos</p>
            </button>
            <button
              type="button"
              onClick={() => chooseByNameHint('carcaza')}
              className="rounded-2xl border border-gray-100 bg-gray-50 px-6 py-5 text-center shadow-sm transition hover:border-gray-200 hover:bg-white"
            >
              <p className="text-sm font-medium text-blue-700">Carcaza iPhone</p>
              <p className="mt-1 text-xs text-gray-400">Consultar disponibilidad</p>
            </button>
          </div>
        </div>

        <div className="mt-14">
          <h2 className="text-center text-3xl font-black tracking-tight text-gray-900">
            Buscar más temas
          </h2>
          <div className="mx-auto mt-6 max-w-3xl">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-300">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M10 2a8 8 0 1 1 5.293 14.01l4.348 4.349-1.414 1.414-4.349-4.348A8 8 0 0 1 10 2zm0 2a6 6 0 1 0 0 12a6 6 0 0 0 0-12z" />
                </svg>
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar en Soporte"
                className="w-full rounded-2xl border border-gray-200 bg-white px-12 py-4 text-sm text-gray-900 outline-none focus:border-gray-400"
              />
            </div>
            <p className="mt-2 text-center text-xs text-gray-400">
              Precios base orientativos. El presupuesto final depende del diagnóstico del equipo.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 text-sm text-gray-500">Cargando…</div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {!loading && !error && (items?.length ?? 0) === 0 ? (
          <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Todavía no hay arreglos cargados. Cargalos en el backend con{' '}
            <code className="rounded bg-white/60 px-1 py-0.5">POST /api/v1/reparaciones/tipos</code>.
          </div>
        ) : null}

        {filtered.length ? (
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {filtered.map((it) => {
              const active = it.id_tipo_reparacion === selectedId
              return (
                <button
                  key={it.id_tipo_reparacion}
                  type="button"
                  onClick={() => choose(it.id_tipo_reparacion)}
                  className={[
                    'text-left rounded-2xl border px-5 py-4 transition-colors',
                    active
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 bg-white hover:border-gray-400',
                  ].join(' ')}
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
                </button>
              )
            })}
          </div>
        ) : !loading && !error ? (
          <div className="mt-10 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            No encontramos resultados para <span className="font-medium text-gray-900">{query.trim()}</span>.
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-500">
            {selected ? (
              <>
                Seleccionado: <span className="font-medium text-gray-900">{selected.nombre}</span>
              </>
            ) : (
              'Seleccioná un arreglo para continuar.'
            )}
          </div>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-900 hover:border-gray-400"
          >
            Volver
          </Link>
        </div>
      </section>
    </div>
  )
}

