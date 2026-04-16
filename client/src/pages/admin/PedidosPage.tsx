import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { clearAuthTokens, getAccessToken } from '../../lib/auth'
import { fetchJson } from '../../services/api'

type Pedido = {
  id_pedido: number
  id_usuario: number
  fecha_pedido: string
  estado: string
  total: string
  observaciones?: string | null
}

type ConfirmResponse = {
  id_pedido: number
  estado: string
  mensaje: string
  warnings?: string[]
}

function fmtArs(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString('es-AR')
}

export default function PedidosPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [actionInfo, setActionInfo] = useState<{
    id: number
    kind: 'confirmado' | 'cancelado'
    message: string
  } | null>(null)
  const [warningMsg, setWarningMsg] = useState<string | null>(null)

  function handleAuthError(message: string) {
    const m = message.toLowerCase()
    const shouldReauth =
      m.includes('token inválido') ||
      m.includes('token invalido') ||
      m.includes('expirado') ||
      m.includes('debes iniciar sesión') ||
      m.includes('debes iniciar sesion')

    if (!shouldReauth) return false

    clearAuthTokens()
    const next = encodeURIComponent(location.pathname + location.search)
    navigate(`/login?next=${next}`, { replace: true })
    return true
  }

  async function loadPedidos() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchJson<Pedido[]>('/api/v1/carrito/pedidos-pendientes', {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      })
      setPedidos(data)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudieron cargar los pedidos'
      if (!handleAuthError(message)) {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPedidos()
  }, [])

  async function confirmar(id_pedido: number) {
    setBusyId(id_pedido)
    setError(null)
    setWarningMsg(null)
    try {
      const result = await fetchJson<ConfirmResponse>(`/api/v1/carrito/confirmar-pedido/${id_pedido}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      })

      if (result.estado === 'requiere_verificacion_whatsapp') {
        const warningText = (result.warnings && result.warnings.length > 0)
          ? result.warnings.join('\n')
          : 'Este pedido requiere confirmar disponibilidad con el local por WhatsApp.'

        setWarningMsg(warningText)

        const proceed = window.confirm(
          `${warningText}\n\n¿Ya confirmaste disponibilidad con el local por WhatsApp y querés cerrar la venta ahora?`
        )

        if (!proceed) {
          return
        }

        const forcedResult = await fetchJson<ConfirmResponse>(
          `/api/v1/carrito/confirmar-pedido/${id_pedido}?force=true`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        )

        if (forcedResult.estado !== 'confirmado' && forcedResult.estado !== 'cancelado_sin_stock') {
          throw new Error(forcedResult.mensaje || 'No se pudo confirmar el pedido')
        }

        setActionInfo({
          id: id_pedido,
          kind: forcedResult.estado === 'confirmado' ? 'confirmado' : 'cancelado',
          message: forcedResult.mensaje,
        })
        setPedidos((prev) => prev.filter((p) => p.id_pedido !== id_pedido))
        return
      }

      setActionInfo({
        id: id_pedido,
        kind: result.estado === 'confirmado' ? 'confirmado' : 'cancelado',
        message: result.mensaje,
      })
      setPedidos((prev) => prev.filter((p) => p.id_pedido !== id_pedido))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo confirmar el pedido'
      if (!handleAuthError(message)) {
        setError(message)
      }
    } finally {
      setBusyId(null)
    }
  }

  async function cancelar(id_pedido: number) {
    const proceed = window.confirm('¿Marcar este pedido como cancelado (compra no realizada)?')
    if (!proceed) return

    setBusyId(id_pedido)
    setError(null)
    setWarningMsg(null)

    try {
      const result = await fetchJson<ConfirmResponse>(`/api/v1/carrito/cancelar-pedido/${id_pedido}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      })

      setActionInfo({
        id: id_pedido,
        kind: 'cancelado',
        message: result.mensaje,
      })
      setPedidos((prev) => prev.filter((p) => p.id_pedido !== id_pedido))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo cancelar el pedido'
      if (!handleAuthError(message)) {
        setError(message)
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="mb-8">
          <p className="mb-1.5 text-[11px] tracking-widest text-gray-300 uppercase">
            Fix It · Admin
          </p>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Pedidos pendientes</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400">
            Confirmá los pedidos para bloquear stock y aprobar pagos.
          </p>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {actionInfo ? (
          <div
            className={`mb-5 rounded-2xl px-4 py-3 text-sm ${
              actionInfo.kind === 'confirmado'
                ? 'border border-emerald-100 bg-emerald-50 text-emerald-800'
                : 'border border-amber-100 bg-amber-50 text-amber-800'
            }`}
          >
            Pedido #{actionInfo.id}: {actionInfo.message}
          </div>
        ) : null}

        {warningMsg ? (
          <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {warningMsg}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-gray-400">Cargando pedidos…</p>
        ) : pedidos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/80 px-8 py-16 text-center">
            <p className="text-gray-500">No hay pedidos pendientes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Pedido</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Usuario</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Fecha</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Observaciones</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((pedido) => (
                  <tr key={pedido.id_pedido} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">#{pedido.id_pedido}</td>
                    <td className="px-4 py-3 text-gray-700">ID: {pedido.id_usuario}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(pedido.fecha_pedido)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {fmtArs(pedido.total)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {pedido.observaciones || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          disabled={busyId === pedido.id_pedido}
                          onClick={() => void confirmar(pedido.id_pedido)}
                          className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
                        >
                          {busyId === pedido.id_pedido ? 'Procesando…' : 'Confirmar'}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === pedido.id_pedido}
                          onClick={() => void cancelar(pedido.id_pedido)}
                          className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-40"
                        >
                          {busyId === pedido.id_pedido ? 'Procesando…' : 'Cancelar Compra'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
