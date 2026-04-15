import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { canjeApi } from '../../services/canjeApi'
import type { EquipoOfrecidoCanje } from '../../types/canje'

function fmtGb(v: number | null | undefined) {
  if (v === null || v === undefined) return '—'
  return `${v} GB`
}

export default function CanjePage() {
  const [items, setItems] = useState<EquipoOfrecidoCanje[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await canjeApi.equiposOfrecidos.list(0, 100, true)
        if (!alive) return
        setItems(data)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'No se pudo cargar el canje')
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

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1.5 text-[11px] tracking-widest text-gray-300 uppercase">Fix It · canje</p>
            <h1 className="text-3xl font-black tracking-tight text-gray-900">Canjeá tu equipo</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400">
              Publicá el equipo que querés entregar y revisá las opciones activas de canje disponibles.
            </p>
          </div>
          <Link
            to="/publicar"
            className="inline-flex w-fit items-center justify-center rounded-full bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            Publicar mi celular
          </Link>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-gray-400">Cargando opciones de canje…</p>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/80 px-8 py-16 text-center">
            <p className="text-gray-500">Todavía no hay equipos de canje activos.</p>
            <p className="mt-2 text-sm text-gray-400">
              Si querés, podés publicar el tuyo para que el equipo lo evalúe.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.id_equipo_ofrecido}
                className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex aspect-[4/3] items-end bg-gradient-to-br from-gray-50 to-white p-5">
                  <div className="rounded-3xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">
                    {item.activo ? 'Activo' : 'Inactivo'}
                  </div>
                </div>
                <div className="border-t border-gray-100 p-5">
                  <h2 className="text-lg font-bold text-gray-900">
                    {item.modelo ?? `Equipo #${item.id_equipo_ofrecido}`}
                  </h2>
                  <p className="mt-1 text-sm text-gray-400">
                    {fmtGb(item.capacidad_gb)} · {item.color ?? 'Color no informado'}
                  </p>
                  <ul className="mt-4 space-y-1 text-sm text-gray-500">
                    <li>Estado estético: {item.estado_estetico ?? '—'}</li>
                    <li>Estado funcional: {item.estado_funcional ?? '—'}</li>
                    <li>Batería: {item.bateria_porcentaje ?? '—'}%</li>
                  </ul>
                  {item.observaciones ? (
                    <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-gray-400">
                      {item.observaciones}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
