import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { mediaUrl } from '../../services/api'
import {
  usePublicaciones,
  useIntereses,
  useCambiarEstadoPublicacion,
  useEliminarPublicacion,
} from '../../hooks/queries'
import type { InteresPublicacion, Publicacion } from '../../types/marketplace'

type EstadoFiltro = 'todos' | 'pendiente_revision' | 'publicada' | 'vendida' | 'rechazada' | 'dada_baja'

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

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

export function PublicacionesPage() {
  const [filtro, setFiltro] = useState<EstadoFiltro>('pendiente_revision')
  const [previewImages, setPreviewImages] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: rows = [], isLoading: loadingPubs, error: pubsError } = usePublicaciones()
  const { data: intereses = [], isLoading: loadingInts } = useIntereses()
  const cambiarEstado = useCambiarEstadoPublicacion()
  const eliminarPub = useEliminarPublicacion()

  const loading = loadingPubs || loadingInts
  const error = actionError ?? (pubsError ? (pubsError instanceof Error ? pubsError.message : 'Error') : null)

  const rowsFiltradas = useMemo(() => {
    if (filtro === 'todos') return rows
    return rows.filter((r) => (r.estado ?? '').toLowerCase() === filtro)
  }, [filtro, rows])

  function resumenInteres(idPublicacion: number) {
    const data = intereses.filter((i) => i.id_publicacion === idPublicacion)
    return {
      count: data.length,
      interesados: data,
    }
  }

  function closePreview() {
    setPreviewImages([])
  }

  function handleCambiarEstado(idPublicacion: number, estado: 'publicada' | 'rechazada' | 'dada_baja' | 'vendida') {
    setActionError(null)
    cambiarEstado.mutate({ id: idPublicacion, estado }, {
      onError: (e) => setActionError(e instanceof Error ? e.message : 'No se pudo actualizar estado'),
    })
  }

  function handleDarDeBaja(idPublicacion: number) {
    const motivo = window.prompt('Motivo de baja de la publicación:')
    if (motivo == null) return
    if (!motivo.trim()) {
      setActionError('Debés indicar un motivo para dar de baja la publicación.')
      return
    }
    handleCambiarEstado(idPublicacion, 'dada_baja')
  }

  function handleEliminar(idPublicacion: number) {
    if (!window.confirm(`¿Eliminar definitivamente la publicación #${idPublicacion}? Esta acción no se puede deshacer.`)) return
    setActionError(null)
    eliminarPub.mutate(idPublicacion, {
      onError: (e) => setActionError(e instanceof Error ? e.message : 'No se pudo eliminar la publicación'),
    })
  }

  return (
    <>
      <h1>Marketplace · Publicaciones</h1>
      <p className="lead">
        Panel resumido: aprobá o rechazá publicaciones, y revisá si hay interés de compra.
      </p>

      {error ? <div className="msg-error">{error}</div> : null}

      <div className="toolbar">
        <label className="filter-estado">
          <span className="filter-estado-label">Mostrar</span>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as EstadoFiltro)}>
            <option value="pendiente_revision">Pendientes de aprobación</option>
            <option value="publicada">Publicadas</option>
            <option value="vendida">Vendidas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="dada_baja">Dadas de baja</option>
            <option value="todos">Todas</option>
          </select>
        </label>
      </div>

      <div className="panel">
        <h2>Listado</h2>
        {loading ? (
          <p className="msg-muted">Cargando…</p>
        ) : rowsFiltradas.length === 0 ? (
          <p className="msg-muted">No hay publicaciones para este filtro.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Foto</th>
                  <th>Publicación</th>
                  <th>Equipo</th>
                  <th>Accesorios</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Interés</th>
                  <th>Fecha</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rowsFiltradas.map((p) => {
                  const interes = resumenInteres(p.id_publicacion)
                  const estadoActual = (p.estado ?? '').toLowerCase()
                  const isBusy = cambiarEstado.isPending || eliminarPub.isPending
                  const canApproveReject = estadoActual === 'pendiente_revision'
                  const canBaja = estadoActual === 'publicada'
                  const canVendida = estadoActual === 'publicada'
                  return (
                    <tr key={p.id_publicacion}>
                      <td>{p.id_publicacion}</td>
                      <td>
                        {p.fotos_urls?.[0] ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImages((p.fotos_urls ?? []).map((url) => mediaUrl(url)))}
                            className="btn btn-ghost btn-sm"
                            title="Ver fotos del equipo"
                          >
                            <img
                              src={mediaUrl(p.fotos_urls[0])}
                              alt="Miniatura del equipo"
                              width={40}
                              height={40}
                              style={{ objectFit: 'cover', borderRadius: 6, display: 'block' }}
                            />
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div>{p.titulo ?? p.modelo ?? '—'}</div>
                        <div className="msg-muted">{p.modelo ?? 'Sin modelo'} · Usuario #{p.id_usuario}</div>
                      </td>
                      <td>
                        <div>{p.modelo ?? '—'}</div>
                        <div className="msg-muted">
                          {p.capacidad_gb != null ? `${p.capacidad_gb} GB` : 'Capacidad s/d'} · {p.color ?? 'Color s/d'}
                        </div>
                        <div className="msg-muted">Batería: {p.bateria_porcentaje != null ? `${p.bateria_porcentaje}%` : 's/d'}</div>
                      </td>
                      <td>
                        <div className="msg-muted">{p.tiene_caja ? '✓ Caja' : '✗ Sin caja'}</div>
                        <div className="msg-muted">{p.tiene_cargador ? '✓ Cargador' : '✗ Sin cargador'}</div>
                      </td>
                      <td>{fmtPrecio(p.precio_publicado)}</td>
                      <td>
                        <div>{p.estado ?? '—'}</div>
                        {estadoActual === 'dada_baja' ? <div className="msg-muted">Publicación dada de baja</div> : null}
                      </td>
                      <td>
                        {interes.count === 0 ? (
                          <span className="msg-muted">—</span>
                        ) : (
                          <div>
                            <span className="text-xs font-semibold text-gray-500">{interes.count} interesado(s)</span>
                            <ul className="mt-1 divide-y divide-gray-100">
                              {interes.interesados.map((intRow) => (
                                <li key={intRow.id_interes} className="flex items-center gap-2 py-1">
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs leading-tight font-medium text-gray-900">
                                      {intRow.comprador_nombre ?? intRow.comprador_email ?? `#${intRow.id_usuario_interesado}`}
                                    </p>
                                    <p className="truncate text-xs leading-tight text-gray-400">
                                      {intRow.comprador_telefono ?? intRow.comprador_email ?? '—'}
                                    </p>
                                  </div>
                                  {intRow.whatsapp_url ? (
                                    <a
                                      href={intRow.whatsapp_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="btn btn-ghost btn-sm shrink-0"
                                      title="Contactar por WhatsApp"
                                    >
                                      WA
                                    </a>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                      <td>{fmtFecha(p.fecha_publicacion)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {canApproveReject ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={isBusy}
                              onClick={() => handleCambiarEstado(p.id_publicacion, 'publicada')}
                            >
                              {isBusy ? 'Guardando…' : 'Aprobar'}
                            </button>{' '}
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={isBusy}
                              onClick={() => handleCambiarEstado(p.id_publicacion, 'rechazada')}
                            >
                              Rechazar
                            </button>
                          </>
                        ) : null}
                        {canVendida ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={isBusy}
                            onClick={() => handleCambiarEstado(p.id_publicacion, 'vendida')}
                          >
                            Marcar vendida
                          </button>
                        ) : null}{' '}
                        {canBaja ? (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            disabled={isBusy}
                            onClick={() => handleDarDeBaja(p.id_publicacion)}
                          >
                            Dar de baja
                          </button>
                        ) : null}{' '}
                        {estadoActual === 'publicada' ? (
                          <Link
                            to={`/marketplace/${p.id_publicacion}`}
                            className="btn btn-ghost btn-sm"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Ver detalle
                          </Link>
                        ) : null}
                        {['dada_baja', 'rechazada', 'vendida'].includes(estadoActual) ? (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            disabled={isBusy}
                            onClick={() => handleEliminar(p.id_publicacion)}
                          >
                            Eliminar
                          </button>
                        ) : null}
                        {!canApproveReject && !canBaja && !canVendida && !['dada_baja', 'rechazada', 'vendida'].includes(estadoActual) ? <span className="msg-muted">Sin acciones</span> : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
    </>
  )
}
