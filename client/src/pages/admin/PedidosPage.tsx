import { useCallback, useEffect, useState } from 'react'
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
  cliente?: {
    id: number
    nombre: string | null
    email: string | null
    telefono: string | null
  } | null
  items?: Array<{
    id_producto: number
    producto_nombre: string
    cantidad: number
    precio_unitario: string
    subtotal: string
    id_equipo?: number | null
    imei?: string | null
    estado_equipo?: string | null
  }>
  resumen?: {
    total_items: number
    total_unidades: number
  } | null
}

type ConfirmResponse = {
  id_pedido: number
  estado: string
  mensaje: string
  warnings?: string[]
}

type CandidatoEquipo = {
  id_equipo: number
  imei: string | null
  estado_comercial: string | null
  activo: boolean
  id_modelo: number
  modelo: string | null
  capacidad_gb: number | null
  color: string | null
  es_actual_reservado: boolean
  disponible_para_reasignar: boolean
}

type AdminTab = 'pendientes' | 'entrega'

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

function getClienteDisplay(pedido: Pedido) {
  const nombre = pedido.cliente?.nombre?.trim()
  const email = pedido.cliente?.email?.trim()
  const telefono = pedido.cliente?.telefono?.trim()

  return {
    titulo: nombre || `Usuario #${pedido.id_usuario}`,
    subtitulo: email || telefono || `ID: ${pedido.id_usuario}`,
    extra: email && telefono ? telefono : null,
  }
}

function ItemDetalleList({ pedido }: { pedido: Pedido }) {
  if (!pedido.items || pedido.items.length === 0) {
    return <p className="text-sm text-gray-500">Sin items disponibles para este pedido.</p>
  }
  return (
    <ul className="space-y-1">
      {pedido.items.map((item) => (
        <li
          key={`${pedido.id_pedido}-${item.id_producto}`}
          className="border-b border-gray-50 pb-2 text-sm last:border-0 last:pb-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-gray-800">
              {item.cantidad} x {item.producto_nombre}
            </span>
            <span className="font-medium text-gray-900">{fmtArs(item.subtotal)}</span>
          </div>
          {item.estado_equipo ? (
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-indigo-600">
              Estado stock: {item.estado_equipo}
            </p>
          ) : null}
          {item.imei ? (
            <p className="mt-1 text-xs text-gray-500">
              IMEI: <span className="font-mono text-gray-700">{item.imei}</span>
              {item.id_equipo != null ? (
                <span className="ml-2 text-gray-400">· Equipo #{item.id_equipo}</span>
              ) : null}
            </p>
          ) : item.id_equipo != null ? (
            <p className="mt-1 text-xs text-amber-700">
              Unidad sin IMEI cargado (equipo #{item.id_equipo}). Completalo en inventario antes de entregar.
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-400">Sin unidad física (accesorio u otro ítem).</p>
          )}
        </li>
      ))}
    </ul>
  )
}

export default function PedidosPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [tab, setTab] = useState<AdminTab>('pendientes')
  const [pedidosPendientes, setPedidosPendientes] = useState<Pedido[]>([])
  const [pedidosEntrega, setPedidosEntrega] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [actionInfo, setActionInfo] = useState<{
    id: number
    kind: 'confirmado' | 'cancelado' | 'entrega'
    message: string
  } | null>(null)
  const [warningMsg, setWarningMsg] = useState<string | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [candidateBusy, setCandidateBusy] = useState<number | null>(null)

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

  const loadPedidos = useCallback(async (opts?: { showSpinner?: boolean }) => {
    const showSpinner = opts?.showSpinner !== false
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      const headers = { Authorization: `Bearer ${getAccessToken()}` }
      const [pend, ent] = await Promise.all([
        fetchJson<Pedido[]>('/api/v1/carrito/pedidos-pendientes', { headers }),
        fetchJson<Pedido[]>('/api/v1/carrito/pedidos-confirmados-pendientes-entrega', { headers }),
      ])
      setPedidosPendientes(pend)
      setPedidosEntrega(ent)
      setExpandedKey(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudieron cargar los pedidos'
      if (!handleAuthError(message)) {
        setError(message)
      }
    } finally {
      if (showSpinner) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial y recargas manuales
  }, [])

  useEffect(() => {
    void loadPedidos()
  }, [loadPedidos])

  const displayPedidos = tab === 'pendientes' ? pedidosPendientes : pedidosEntrega

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
        const warningText =
          result.warnings && result.warnings.length > 0
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
        await loadPedidos({ showSpinner: false })
        return
      }

      setActionInfo({
        id: id_pedido,
        kind: result.estado === 'confirmado' ? 'confirmado' : 'cancelado',
        message: result.mensaje,
      })
      await loadPedidos({ showSpinner: false })
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
      await loadPedidos({ showSpinner: false })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo cancelar el pedido'
      if (!handleAuthError(message)) {
        setError(message)
      }
    } finally {
      setBusyId(null)
    }
  }

  async function finalizarEntrega(id_pedido: number) {
    const proceed = window.confirm(
      '¿Marcar la entrega como finalizada? Los equipos en reserva pasan a vendido y se desactivan en catálogo.',
    )
    if (!proceed) return

    setBusyId(id_pedido)
    setError(null)
    try {
      const result = await fetchJson<ConfirmResponse>(`/api/v1/carrito/finalizar-entrega/${id_pedido}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      })
      setActionInfo({ id: id_pedido, kind: 'entrega', message: result.mensaje })
      await loadPedidos({ showSpinner: false })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo finalizar la entrega'
      if (!handleAuthError(message)) setError(message)
    } finally {
      setBusyId(null)
    }
  }

  async function anularPedidoConfirmado(id_pedido: number) {
    const proceed = window.confirm(
      '¿Anular este pedido confirmado? Se liberará la reserva de stock (unidades vuelven a la venta).',
    )
    if (!proceed) return

    setBusyId(id_pedido)
    setError(null)
    try {
      const result = await fetchJson<ConfirmResponse>(
        `/api/v1/carrito/cancelar-pedido-confirmado/${id_pedido}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        },
      )
      setActionInfo({ id: id_pedido, kind: 'cancelado', message: result.mensaje })
      await loadPedidos({ showSpinner: false })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo anular el pedido'
      if (!handleAuthError(message)) setError(message)
    } finally {
      setBusyId(null)
    }
  }

  async function reasignarImei(pedido: Pedido, item: NonNullable<Pedido['items']>[number]) {
    if (item.id_equipo == null) {
      setError('Este ítem no tiene equipo asignado para reasignar.')
      return
    }
    setError(null)
    setWarningMsg(null)
    setCandidateBusy(pedido.id_pedido)
    try {
      const candidatos = await fetchJson<CandidatoEquipo[]>(
        `/api/v1/carrito/pedido/${pedido.id_pedido}/candidatos-reasignacion?id_producto=${item.id_producto}`,
        {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        },
      )
      const disponibles = candidatos.filter((c) => c.disponible_para_reasignar)
      if (disponibles.length === 0) {
        throw new Error('No hay otra unidad disponible del mismo producto para reasignar.')
      }
      const opcionesTxt = disponibles
        .map(
          (c) =>
            `#${c.id_equipo} · IMEI: ${c.imei ?? 's/imei'} · ${c.modelo ?? 'Modelo'} ${c.capacidad_gb ?? ''} ${c.color ?? ''}`.trim(),
        )
        .join('\n')
      const elegidoRaw = window.prompt(
        `Reasignar IMEI para pedido #${pedido.id_pedido}\nProducto: ${item.producto_nombre}\n\nUnidades disponibles:\n${opcionesTxt}\n\nIngresá el ID de equipo a asignar:`,
        String(disponibles[0].id_equipo),
      )
      if (!elegidoRaw) return
      const idEquipoNuevo = Number(elegidoRaw)
      if (!Number.isFinite(idEquipoNuevo) || idEquipoNuevo < 1) {
        throw new Error('ID de equipo inválido.')
      }
      const valido = disponibles.some((c) => c.id_equipo === idEquipoNuevo)
      if (!valido) {
        throw new Error('El equipo elegido no está en la lista de candidatos disponibles.')
      }
      const motivo = window.prompt('Motivo del cambio de IMEI (opcional):', 'No encontraron la unidad original')
      const result = await fetchJson<ConfirmResponse>(
        `/api/v1/carrito/pedido/${pedido.id_pedido}/reasignar-equipo?id_producto=${item.id_producto}&id_equipo_nuevo=${idEquipoNuevo}${motivo ? `&motivo=${encodeURIComponent(motivo)}` : ''}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        },
      )
      setActionInfo({ id: pedido.id_pedido, kind: 'confirmado', message: result.mensaje })
      await loadPedidos({ showSpinner: false })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo reasignar el IMEI'
      if (!handleAuthError(message)) setError(message)
    } finally {
      setCandidateBusy(null)
    }
  }

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="mb-8">
          <p className="mb-1.5 text-[11px] tracking-widest text-gray-300 uppercase">Fix It · Admin</p>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Pedidos</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400">
            <strong>Pendientes:</strong> confirmá la compra y se reserva el stock.{' '}
            <strong>Cerrar entrega:</strong> cuando el equipo salió o se entregó, finalizá para marcar vendido en
            inventario; podés anular antes de eso para liberar la reserva.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-4">
          <button
            type="button"
            onClick={() => {
              setTab('pendientes')
              setExpandedKey(null)
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === 'pendientes' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Pendientes de confirmación
            {pedidosPendientes.length > 0 ? (
              <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">{pedidosPendientes.length}</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('entrega')
              setExpandedKey(null)
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === 'entrega' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Cerrar entrega (reserva)
            {pedidosEntrega.length > 0 ? (
              <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">{pedidosEntrega.length}</span>
            ) : null}
          </button>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {actionInfo ? (
          <div
            className={`mb-5 rounded-2xl px-4 py-3 text-sm ${
              actionInfo.kind === 'cancelado'
                ? 'border border-amber-100 bg-amber-50 text-amber-800'
                : 'border border-emerald-100 bg-emerald-50 text-emerald-800'
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
        ) : displayPedidos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/80 px-8 py-16 text-center">
            <p className="text-gray-500">
              {tab === 'pendientes'
                ? 'No hay pedidos pendientes de confirmación.'
                : 'No hay pedidos confirmados esperando cierre de entrega.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Pedido</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Cliente</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Items</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Fecha</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayPedidos.map((pedido) => {
                  const rowKey = `${tab}-${pedido.id_pedido}`
                  const isOpen = expandedKey === rowKey
                  return (
                    <tr key={pedido.id_pedido} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">#{pedido.id_pedido}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <p className="font-medium text-gray-900">{getClienteDisplay(pedido).titulo}</p>
                        <p className="text-xs text-gray-500">{getClienteDisplay(pedido).subtitulo}</p>
                        {getClienteDisplay(pedido).extra ? (
                          <p className="text-xs text-gray-500">{getClienteDisplay(pedido).extra}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => setExpandedKey((prev) => (prev === rowKey ? null : rowKey))}
                        >
                          <p className="text-sm font-medium text-gray-900">
                            {pedido.resumen?.total_items ?? pedido.items?.length ?? 0} productos
                          </p>
                          <p className="text-xs text-gray-500">
                            {pedido.resumen?.total_unidades ??
                              pedido.items?.reduce((acc, item) => acc + (item.cantidad || 0), 0) ??
                              0}{' '}
                            unidades · {isOpen ? 'Ocultar detalle' : 'Ver detalle'}
                          </p>
                        </button>
                        {isOpen ? (
                          <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
                            <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                              Detalle del pedido
                            </p>
                            <ItemDetalleList pedido={pedido} />
                            {tab === 'entrega' && pedido.items && pedido.items.length > 0 ? (
                              <div className="mt-3 border-t border-gray-100 pt-2">
                                <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                                  Reasignar IMEI
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {pedido.items
                                    .filter((item) => item.id_equipo != null)
                                    .map((item) => (
                                      <button
                                        key={`reasignar-${pedido.id_pedido}-${item.id_producto}`}
                                        type="button"
                                        disabled={candidateBusy === pedido.id_pedido || busyId === pedido.id_pedido}
                                        onClick={() => void reasignarImei(pedido, item)}
                                        className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
                                      >
                                        {candidateBusy === pedido.id_pedido
                                          ? 'Buscando…'
                                          : `Cambiar IMEI · ${item.producto_nombre}`}
                                      </button>
                                    ))}
                                </div>
                              </div>
                            ) : null}
                            {pedido.observaciones ? (
                              <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-600">
                                <span className="font-semibold text-gray-700">Observaciones:</span>{' '}
                                {pedido.observaciones}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(pedido.fecha_pedido)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtArs(pedido.total)}</td>
                      <td className="px-4 py-3 text-center">
                        {tab === 'pendientes' ? (
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
                              {busyId === pedido.id_pedido ? 'Procesando…' : 'Cancelar compra'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
                            <button
                              type="button"
                              disabled={busyId === pedido.id_pedido}
                              onClick={() => void finalizarEntrega(pedido.id_pedido)}
                              className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
                            >
                              {busyId === pedido.id_pedido ? 'Procesando…' : 'Finalizar entrega'}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === pedido.id_pedido}
                              onClick={() => void anularPedidoConfirmado(pedido.id_pedido)}
                              className="rounded-full border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-40"
                            >
                              Anular y liberar stock
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
