import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { marketplaceApi } from '../../services/marketplaceApi'
import type { Publicacion } from '../../types/marketplace'
import { ProductShowcaseCard } from '../../components/ProductShowcaseCard'

function specsLine(p: Publicacion): string[] {
  const parts: string[] = []
  if (p.modelo) parts.push(p.modelo)
  if (p.capacidad_gb != null) parts.push(`${p.capacidad_gb} GB`)
  if (p.color) parts.push(p.color)
  return parts.length ? parts : ['Equipo publicado']
}

function familyLabelFromPublicacion(p: Publicacion): string {
  const source = `${p.modelo ?? ''} ${p.titulo ?? ''}`.toLowerCase()
  if (source.includes('iphone')) return 'iPhone'
  if (source.includes('ipad')) return 'iPad'
  if (source.includes('macbook') || source.includes('mac')) return 'MacBook'
  if (source.includes('watch')) return 'Watch'
  if (source.includes('airpods')) return 'AirPods'
  return 'Marketplace'
}

export default function MarketplacePublicacionesPage() {
  const [items, setItems] = useState<Publicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      // Compatibilidad: algunas publicaciones legacy pueden estar como "aprobada".
      const data = await marketplaceApi.publicaciones.list(0, 100, null)
      setItems(
        data.filter((p) => {
          const estado = (p.estado ?? '').toLowerCase().trim()
          return estado === 'publicada' || estado === 'aprobada'
        }),
      )
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
            <p className="mb-1.5 text-[11px] tracking-widest text-gray-300 uppercase">Fix It · marketplace</p>
            <h1 className="text-3xl font-black tracking-tight text-gray-900">Equipos publicados por clientes</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400">
              Catálogo de equipos publicados por otros clientes. Entra al detalle para ver fotos, especificaciones y
              registrar tu interés.
            </p>
          </div>
          <Link
            to="/publicar"
            className="inline-flex w-fit items-center justify-center rounded-full bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            Publicar mi equipo
          </Link>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        {loading ? (
          <p className="text-sm text-gray-400">Cargando publicaciones…</p>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/80 px-8 py-16 text-center">
            <p className="text-gray-500">Todavía no hay publicaciones aprobadas en marketplace.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => {
              return (
                <div
                  key={p.id_publicacion}
                  className="flex"
                >
                  <ProductShowcaseCard
                    title={p.titulo ?? p.modelo ?? `Publicación #${p.id_publicacion}`}
                    description={p.descripcion ?? specsLine(p).join(' · ')}
                    familyLabel={familyLabelFromPublicacion(p)}
                    imageUrl={p.fotos_urls?.[0] ?? null}
                    badgeTag="Marketplace"
                    arsPrice={p.precio_publicado}
                    detailTo={`/marketplace/${p.id_publicacion}`}
                  />
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
