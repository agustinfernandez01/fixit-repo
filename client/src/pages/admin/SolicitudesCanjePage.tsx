import { useEffect, useState } from 'react'
import { canjeApi } from '../../services/canjeApi'
import { mediaUrl } from '../../services/api'
import type { SolicitudCanjeAdminResponse } from '../../types/canje'

const PAYMENT_OPTIONS = ['a definir', 'efectivo', 'transferencia', 'tarjeta', 'canje'] as const

function fmtDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-AR')
}

function fmtTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function fmtMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(n)) return String(value)
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

function buildEquipoLabel(row: SolicitudCanjeAdminResponse) {
  const parts = [row.equipo_modelo, row.equipo_capacidad_gb ? `${row.equipo_capacidad_gb} GB` : null, row.equipo_color]
  return parts.filter(Boolean).join(' · ') || '—'
}

function normalizeArPhoneForWhatsApp(raw: string | null | undefined) {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('54')) return digits
  if (digits.startsWith('0')) return `54${digits.slice(1)}`
  return `54${digits}`
}

function buildWhatsAppApprovalUrl(row: SolicitudCanjeAdminResponse) {
  const phone = normalizeArPhoneForWhatsApp(row.cliente_telefono)
  if (!phone) return null
  const nombre = row.cliente_nombre?.trim() || 'cliente'
  const producto = row.producto_interes_nombre?.trim() || 'producto elegido'
  const mensaje = [
    `Hola ${nombre}, te escribimos de Fix It.`,
    `Tu solicitud de canje #${row.id_solicitud_canje} fue aprobada.`,
    `Producto: ${producto}.`,
    'Cuando quieras coordinamos la entrega.',
  ].join(' ')
  return `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`
}

export default function SolicitudesCanjePage() {
  const [rows, setRows] = useState<SolicitudCanjeAdminResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [previewImages, setPreviewImages] = useState<string[]>([])
  const [estadoFilter, setEstadoFilter] = useState<'pendiente' | 'completado' | 'rechazado' | 'todos'>('pendiente')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await canjeApi.solicitudesAdmin.list(
        0,
        100,
        estadoFilter === 'todos' ? null : estadoFilter,
      )
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las solicitudes de canje')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [estadoFilter])

  async function handleDecision(id: number, action: 'completar' | 'rechazar') {
    const confirmMsg =
      action === 'completar'
        ? '¿Aprobar esta solicitud y descontar stock del producto elegido?'
        : '¿Rechazar esta solicitud de canje?'
    if (!window.confirm(confirmMsg)) return
    setBusyId(id)
    setError(null)
    try {
      const current = rows.find((row) => row.id_solicitud_canje === id)
      const payload = { metodo_pago: current?.metodo_pago ?? 'a definir' }
      const updated =
        action === 'completar'
          ? await canjeApi.solicitudesAdmin.completar(id, payload)
          : await canjeApi.solicitudesAdmin.rechazar(id, payload)
      if (action === 'completar') {
        const waUrl = buildWhatsAppApprovalUrl(updated)
        if (waUrl) {
          window.open(waUrl, '_blank', 'noopener,noreferrer')
        } else {
          setError(
            'Canje aprobado, pero este cliente no tiene teléfono válido para abrir WhatsApp. Completa el teléfono en su perfil.',
          )
        }
      }
      if (action === 'rechazar') {
        setRows((prev) => prev.filter((row) => row.id_solicitud_canje !== id))
      } else {
        setRows((prev) => prev.map((row) => (row.id_solicitud_canje === id ? updated : row)))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar la solicitud')
    } finally {
      setBusyId(null)
    }
  }

  async function handleBorrarHistorial(id: number) {
    setBusyId(id)
    setError(null)
    try {
      await canjeApi.solicitudesAdmin.borrarHistorial(id)
      setRows((prev) => prev.filter((row) => row.id_solicitud_canje !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar la solicitud del historial')
    } finally {
      setBusyId(null)
    }
  }

  function updateMetodoPago(id: number, value: string) {
    setRows((prev) => prev.map((row) => (row.id_solicitud_canje === id ? { ...row, metodo_pago: value } : row)))
  }

  const closePreview = () => setPreviewImages([])

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1.5 text-[11px] tracking-widest text-gray-300 uppercase">Fix It · Admin</p>
            <h1 className="text-3xl font-black tracking-tight text-gray-900">Solicitudes de canje</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
              Revisá cada canje, confirmá si se completa y descontá el stock del producto solicitado cuando corresponda.
            </p>
          </div>
          <a href="/admin" className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900">
            ← Volver al panel
          </a>
        </div>

        <div className="mb-5 inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          {([
            { key: 'pendiente', label: 'Pendientes' },
            { key: 'completado', label: 'Completadas' },
            { key: 'rechazado', label: 'Rechazadas' },
            { key: 'todos', label: 'Todas' },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setEstadoFilter(opt.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                estadoFilter === opt.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-gray-400">Cargando solicitudes…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/80 px-8 py-16 text-center">
            <p className="text-gray-500">No hay solicitudes de canje para revisar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Solicitud</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Cliente</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Hora</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Ofrece</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Quiere</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Pago</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Diferencia</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Estado</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const estado = (row.estado ?? '').toLowerCase()
                  const isBusy = busyId === row.id_solicitud_canje
                  const canDecide = estado !== 'completado' && estado !== 'rechazado'
                  const canDeleteHistory = estado === 'completado'
                  return (
                    <tr key={row.id_solicitud_canje} className="border-b border-gray-100 align-top hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">#{row.id_solicitud_canje}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <div className="font-medium text-gray-900">{row.cliente_nombre ?? `Usuario #${row.id_usuario}`}</div>
                        <div className="text-xs text-gray-500">{row.cliente_email ?? '—'}</div>
                        <div className="text-xs text-gray-500">{row.cliente_telefono ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(row.fecha_solicitud)}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtTime(row.fecha_solicitud)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="font-medium text-gray-900">{buildEquipoLabel(row)}</div>
                        <div className="text-xs text-gray-500">
                          Bateria: {row.equipo_bateria_porcentaje ?? '—'}% · Estado: {row.equipo_estado_estetico ?? '—'} / {row.equipo_estado_funcional ?? '—'}
                        </div>
                        {(row.equipo_fotos_urls?.length ?? 0) > 0 ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImages(row.equipo_fotos_urls.map((url) => mediaUrl(url)))}
                            className="mt-2 overflow-hidden rounded-xl border border-gray-200"
                          >
                            <img
                              src={mediaUrl(row.equipo_fotos_urls[0])}
                              alt="Equipo ofrecido"
                              className="h-16 w-16 object-cover"
                            />
                          </button>
                        ) : row.equipo_foto_url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImages([mediaUrl(row.equipo_foto_url as string)])}
                            className="mt-2 overflow-hidden rounded-xl border border-gray-200"
                          >
                            <img
                              src={mediaUrl(row.equipo_foto_url)}
                              alt="Equipo ofrecido"
                              className="h-16 w-16 object-cover"
                            />
                          </button>
                        ) : (
                          <div className="mt-1 text-xs text-gray-400">Sin foto adjunta</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="font-medium text-gray-900">{row.producto_interes_nombre ?? '—'}</div>
                        <div className="text-xs text-gray-500">{fmtMoney(row.producto_interes_precio)}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <select
                          value={row.metodo_pago ?? 'a definir'}
                          onChange={(e) => updateMetodoPago(row.id_solicitud_canje, e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700"
                          disabled={isBusy || !canDecide}
                        >
                          {PAYMENT_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {row.diferencia_a_pagar != null ? fmtMoney(row.diferencia_a_pagar) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                          {row.estado ?? 'pendiente'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            disabled={isBusy || !canDecide}
                            onClick={() => void handleDecision(row.id_solicitud_canje, 'completar')}
                            className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
                          >
                            {busyId === row.id_solicitud_canje ? 'Procesando…' : 'Aprobar'}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy || !canDecide}
                            onClick={() => void handleDecision(row.id_solicitud_canje, 'rechazar')}
                            className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-40"
                          >
                            {busyId === row.id_solicitud_canje ? 'Procesando…' : 'Rechazar'}
                          </button>
                          {canDeleteHistory ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleBorrarHistorial(row.id_solicitud_canje)}
                              className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-40"
                            >
                              Borrar historial
                            </button>
                          ) : null}
                        </div>
                        {row.fecha_respuesta ? (
                          <div className="mt-2 text-xs text-gray-500">
                            Respuesta: {fmtDate(row.fecha_respuesta)} {fmtTime(row.fecha_respuesta)}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {previewImages.length > 0 ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Fotos del equipo</h3>
              <button
                type="button"
                onClick={closePreview}
                className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600"
              >
                Cerrar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {previewImages.map((img, idx) => (
                <img
                  key={`${img}-${idx}`}
                  src={img}
                  alt={`Equipo ${idx + 1}`}
                  className="h-32 w-full rounded-xl object-cover sm:h-40"
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}