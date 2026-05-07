import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAccessToken } from '../../lib/auth'
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

export default function MarketplaceDetallePage() {
  const { id } = useParams()
  const publicationId = Number(id)
  const logged = !!getAccessToken()
  const [item, setItem] = useState<Publicacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImg, setSelectedImg] = useState(0)
  const [mensaje, setMensaje] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      if (!Number.isFinite(publicationId) || publicationId <= 0) {
        throw new Error('Publicación inválida')
      }
      const data = await marketplaceApi.publicaciones.get(publicationId)
      const estado = (data.estado ?? '').toLowerCase().trim()
      if (estado !== 'publicada' && estado !== 'aprobada') {
        throw new Error('La publicación no está disponible.')
      }
      setItem(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el detalle')
    } finally {
      setLoading(false)
    }
  }, [publicationId])

  useEffect(() => {
    void load()
  }, [load])

  const fotos = useMemo(() => (item?.fotos_urls ?? []).filter(Boolean), [item])

  async function registrarInteres() {
    if (!item) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      if (!logged) {
        throw new Error('Debes iniciar sesión para registrar interés.')
      }
      const created = await marketplaceApi.intereses.create({
        id_publicacion: item.id_publicacion,
        mensaje: mensaje.trim() || null,
      })
      setSuccess('Interés registrado. También abriremos WhatsApp para acelerar el contacto.')
      if (created.whatsapp_url) {
        window.open(created.whatsapp_url, '_blank', 'noopener,noreferrer')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar tu interés')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-gray-500">Cargando publicación…</div>
  }
  if (error || !item) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error ?? 'No encontrada'}</div>
      </div>
    )
  }

  return (
    <div className="bg-white">
      <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-16 pt-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <Link to="/marketplace" className="text-sm text-[#0071e3] hover:underline">
            ‹ Volver a marketplace
          </Link>
          <div className="mt-4 overflow-hidden rounded-3xl border border-gray-100 bg-gray-50">
            {fotos[selectedImg] ? (
              <img src={mediaUrl(fotos[selectedImg])} alt={item.titulo ?? item.modelo ?? ''} className="h-[420px] w-full object-contain" />
            ) : (
              <div className="flex h-[420px] items-center justify-center text-sm text-gray-400">Sin fotos</div>
            )}
          </div>
          {fotos.length > 1 ? (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {fotos.map((url, idx) => (
                <button
                  key={`${url}-${idx}`}
                  type="button"
                  onClick={() => setSelectedImg(idx)}
                  className={`overflow-hidden rounded-xl border ${idx === selectedImg ? 'border-gray-900' : 'border-gray-200'}`}
                >
                  <img src={mediaUrl(url)} alt={`Foto ${idx + 1}`} className="h-16 w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-[11px] tracking-widest text-gray-400 uppercase">Marketplace</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">{item.titulo ?? item.modelo ?? `Publicación #${item.id_publicacion}`}</h1>
          <p className="mt-3 text-3xl font-black text-gray-900">{fmtPrecio(item.precio_publicado)}</p>

          <div className="mt-5 space-y-2 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
            <p><strong>Publicado por:</strong> {item.vendedor_nombre ?? `Usuario #${item.id_usuario}`}</p>
            <p><strong>Contacto:</strong> {item.vendedor_telefono ?? 'A coordinar por Fix It'}</p>
            <p><strong>Modelo:</strong> {item.modelo ?? '—'}</p>
            <p><strong>Capacidad:</strong> {item.capacidad_gb != null ? `${item.capacidad_gb} GB` : '—'}</p>
            <p><strong>Color:</strong> {item.color ?? '—'}</p>
            <p><strong>Batería:</strong> {item.bateria_porcentaje != null ? `${item.bateria_porcentaje}%` : '—'}</p>
            <p><strong>Estado estético:</strong> {item.estado_estetico ?? '—'}</p>
            <p><strong>Estado funcional:</strong> {item.estado_funcional ?? '—'}</p>
            <p><strong>Caja original:</strong> {item.tiene_caja ? 'Incluye' : 'No incluye'}</p>
            <p><strong>Cargador:</strong> {item.tiene_cargador ? 'Incluye' : 'No incluye'}</p>
          </div>

          {item.descripcion ? <p className="mt-4 text-sm leading-relaxed text-gray-600">{item.descripcion}</p> : null}

          {success ? <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{success}</div> : null}
          {error ? <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}

          <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-4">
            <label className="mb-1 block text-xs font-medium text-gray-500">Mensaje opcional para el admin</label>
            <textarea
              rows={3}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
              placeholder="Ej. Me interesa coordinar visita o conocer más detalles."
            />
            <button
              type="button"
              onClick={() => void registrarInteres()}
              disabled={saving}
              className="mt-3 inline-flex items-center justify-center rounded-full bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-60"
            >
              {saving ? 'Enviando…' : 'Me interesa este equipo'}
            </button>
            {!logged ? (
              <p className="mt-2 text-xs text-amber-700">
                Debes iniciar sesión para registrar interés.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
