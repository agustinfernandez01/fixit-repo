import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { mediaUrl } from '../../services/api'
import { marketplaceApi } from '../../services/marketplaceApi'
import type { Publicacion } from '../../types/marketplace'

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

function specsLine(p: Publicacion): string[] {
  const parts: string[] = []
  if (p.modelo) parts.push(p.modelo)
  if (p.capacidad_gb != null) parts.push(`${p.capacidad_gb} GB`)
  if (p.color) parts.push(p.color)
  return parts.length ? parts : ['Equipo usado']
}

export default function MarketplaceTiendaPage() {
  const [items, setItems] = useState<Publicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await marketplaceApi.publicaciones.list(0, 100, 'publicada')
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el marketplace')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1.5 text-[11px] tracking-widest text-gray-300 uppercase">
              Fix It · usados verificados
            </p>
            <h1 className="text-3xl font-black tracking-tight text-gray-900">
              Marketplace
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400">
              Equipos revisados por nuestro equipo antes de publicarse. Cada aviso pasó
              por moderación Fix It.
            </p>
          </div>
          <Link
            to="/publicar"
            className="inline-flex w-fit items-center justify-center rounded-full bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            Vender mi celular
          </Link>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-gray-400">Cargando publicaciones…</p>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/80 px-8 py-16 text-center">
            <p className="text-gray-500">
              Todavía no hay equipos publicados. Sé el primero en{' '}
              <Link to="/publicar" className="font-medium text-gray-900 underline">
                publicar el tuyo
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => {
              const img = p.fotos_urls?.[0]
              const src = mediaUrl(img ?? '')
              return (
                <article
                  key={p.id_publicacion}
                  className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] bg-gray-100">
                    {src ? (
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-300">
                        <svg className="h-14 w-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                      Verificado
                    </span>
                  </div>
                  <div className="border-t border-gray-100 p-5">
                    <h2 className="text-lg font-bold text-gray-900">
                      {p.titulo ?? p.modelo ?? `Publicación #${p.id_publicacion}`}
                    </h2>
                    <p className="mt-1 text-2xl font-black text-gray-900">
                      {fmtPrecio(p.precio_publicado)}
                    </p>
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {specsLine(p).map((s) => (
                        <li
                          key={s}
                          className="rounded-lg bg-gray-50 px-2.5 py-1 text-[11px] text-gray-500"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                    {p.descripcion ? (
                      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-gray-400">
                        {p.descripcion}
                      </p>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
