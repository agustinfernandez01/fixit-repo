import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { mediaUrl } from '../../services/api'
import {
  usePublicaciones,
  useIntereses,
  useCambiarEstadoPublicacion,
  useEliminarPublicacion,
  useEditarPublicacion,
} from '../../hooks/queries'
import type { InteresPublicacion, Publicacion } from '../../types/marketplace'

type EstadoFiltro = 'todos' | 'pendiente_revision' | 'publicada' | 'vendida' | 'rechazada' | 'dada_baja'

const ESTADO_BADGE: Record<string, string> = {
  pendiente_revision: 'bg-amber-100 text-amber-800',
  publicada: 'bg-green-100 text-green-800',
  vendida: 'bg-blue-100 text-blue-800',
  rechazada: 'bg-red-100 text-red-800',
  dada_baja: 'bg-gray-200 text-gray-600',
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente_revision: 'Pendiente',
  publicada: 'Publicada',
  vendida: 'Vendida',
  rechazada: 'Rechazada',
  dada_baja: 'Dada de baja',
}

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('es-AR') } catch { return iso }
}

function fmtPrecio(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value ?? '—'}</p>
    </div>
  )
}

function PubCard({
  p,
  interesCount,
  onClick,
}: {
  p: Publicacion
  interesCount: number
  onClick: () => void
}) {
  const foto = p.fotos_urls?.[0]
  const estado = (p.estado ?? '').toLowerCase()
  const badge = ESTADO_BADGE[estado] ?? 'bg-gray-100 text-gray-600'
  const label = ESTADO_LABEL[estado] ?? p.estado ?? '—'

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-150 overflow-hidden flex flex-col w-full"
    >
      {/* Foto */}
      <div className="relative h-44 bg-gray-100 overflow-hidden">
        {foto ? (
          <img loading="lazy"
            src={mediaUrl(foto)}
            alt="Equipo"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl text-gray-300 select-none">
            📱
          </div>
        )}
        <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${badge}`}>
          {label}
        </span>
        {interesCount > 0 && (
          <span className="absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white">
            {interesCount} interesado{interesCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="font-semibold text-sm text-gray-900 leading-snug line-clamp-2">
          {p.titulo ?? p.modelo ?? 'Sin título'}
        </p>
        <p className="text-xs text-gray-500">
          {[
            p.capacidad_gb != null ? `${p.capacidad_gb} GB` : null,
            p.color,
          ]
            .filter(Boolean)
            .join(' · ') || 'Sin especificar'}
        </p>
        <p className="text-sm font-bold text-gray-900 mt-auto pt-2">{fmtPrecio(p.precio_publicado)}</p>
        <p className="text-xs text-gray-400 truncate">
          {p.vendedor_nombre ?? `Usuario #${p.id_usuario}`}
        </p>
      </div>
    </button>
  )
}

function DetalleModal({
  pub,
  intereses,
  onClose,
  onAccion,
  onEditar,
  onEliminar,
  isBusy,
}: {
  pub: Publicacion
  intereses: InteresPublicacion[]
  onClose: () => void
  onAccion: (estado: string) => void
  onEditar: () => void
  onEliminar: () => void
  isBusy: boolean
}) {
  const [fotoIdx, setFotoIdx] = useState(0)
  const fotos = (pub.fotos_urls ?? []).map((url) => mediaUrl(url))
  const estado = (pub.estado ?? '').toLowerCase()
  const badge = ESTADO_BADGE[estado] ?? 'bg-gray-100 text-gray-600'
  const label = ESTADO_LABEL[estado] ?? pub.estado ?? '—'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-semibold text-gray-900 text-sm truncate">
              {pub.titulo ?? pub.modelo ?? `Publicación #${pub.id_publicacion}`}
            </h2>
            <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${badge}`}>
              {label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 shrink-0 text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Fotos */}
          {fotos.length > 0 && (
            <div className="flex flex-col gap-2">
              <img loading="lazy"
                src={fotos[fotoIdx]}
                alt="Equipo"
                className="w-full h-56 object-cover rounded-xl bg-gray-100"
              />
              {fotos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {fotos.map((url, i) => (
                    <button
                      key={`${url}-${i}`}
                      type="button"
                      onClick={() => setFotoIdx(i)}
                      className={`shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                        i === fotoIdx ? 'border-gray-900' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img loading="lazy" src={url} alt={`Foto ${i + 1}`} className="w-14 h-14 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Campos */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Modelo" value={pub.modelo} />
            <Field label="Capacidad" value={pub.capacidad_gb != null ? `${pub.capacidad_gb} GB` : null} />
            <Field label="Color" value={pub.color} />
            <Field label="IMEI" value={pub.imei} />
            <Field label="Batería" value={pub.bateria_porcentaje != null ? `${pub.bateria_porcentaje}%` : null} />
            <Field label="Precio" value={fmtPrecio(pub.precio_publicado)} />
            <Field label="Estado estético" value={pub.estado_estetico} />
            <Field label="Estado funcional" value={pub.estado_funcional} />
            <Field
              label="Caja"
              value={pub.tiene_caja ? 'Sí incluye' : pub.tiene_caja === false ? 'No incluye' : null}
            />
            <Field
              label="Cargador"
              value={pub.tiene_cargador ? 'Sí incluye' : pub.tiene_cargador === false ? 'No incluye' : null}
            />
            <Field label="Vendedor" value={pub.vendedor_nombre} />
            <Field label="Teléfono" value={pub.vendedor_telefono} />
            <Field label="Fecha" value={fmtFecha(pub.fecha_publicacion)} />
          </div>

          {pub.descripcion && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1">Descripción</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{pub.descripcion}</p>
            </div>
          )}

          {/* Interesados */}
          {intereses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">
                Interesados ({intereses.length})
              </p>
              <div className="flex flex-col gap-1.5">
                {intereses.map((i) => (
                  <div
                    key={i.id_interes}
                    className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2"
                  >
                    <div>
                      <p className="text-xs font-medium text-gray-900">
                        {i.comprador_nombre ?? i.comprador_email ?? `#${i.id_usuario_interesado}`}
                      </p>
                      <p className="text-xs text-gray-400">
                        {i.comprador_telefono ?? i.comprador_email ?? '—'}
                      </p>
                    </div>
                    {i.whatsapp_url ? (
                      <a
                        href={i.whatsapp_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded-lg font-medium transition-colors"
                      >
                        WA
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            {estado === 'pendiente_revision' && (
              <>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onAccion('publicada')}
                  className="btn btn-primary btn-sm"
                >
                  {isBusy ? 'Guardando…' : 'Aprobar'}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onAccion('rechazada')}
                  className="btn btn-danger btn-sm"
                >
                  Rechazar
                </button>
              </>
            )}
            {estado === 'publicada' && (
              <>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onAccion('vendida')}
                  className="btn btn-primary btn-sm"
                >
                  Marcar vendida
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    const motivo = window.prompt('Motivo de baja de la publicación:')
                    if (motivo == null) return
                    if (!motivo.trim()) return
                    onAccion('dada_baja')
                  }}
                  className="btn btn-danger btn-sm"
                >
                  Dar de baja
                </button>
                <Link
                  to={`/marketplace/${pub.id_publicacion}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  Ver en tienda
                </Link>
              </>
            )}
            {['dada_baja', 'rechazada', 'vendida'].includes(estado) && (
              <button
                type="button"
                disabled={isBusy}
                onClick={onEliminar}
                className="btn btn-danger btn-sm"
              >
                Eliminar
              </button>
            )}
            <button
              type="button"
              onClick={onEditar}
              className="ml-auto btn btn-ghost btn-sm border border-gray-200"
            >
              Editar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditarModal({
  pub,
  onClose,
  onSave,
  isBusy,
}: {
  pub: Publicacion
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
  isBusy: boolean
}) {
  const [form, setForm] = useState({
    modelo: pub.modelo ?? '',
    capacidad_gb: pub.capacidad_gb != null ? String(pub.capacidad_gb) : '',
    color: pub.color ?? '',
    imei: pub.imei ?? '',
    bateria_porcentaje: pub.bateria_porcentaje != null ? String(pub.bateria_porcentaje) : '',
    estado_estetico: pub.estado_estetico ?? '',
    estado_funcional: pub.estado_funcional ?? '',
    descripcion: pub.descripcion ?? '',
    precio_publicado: pub.precio_publicado != null ? String(pub.precio_publicado) : '',
    tiene_caja: pub.tiene_caja ?? false,
    tiene_cargador: pub.tiene_cargador ?? false,
  })

  function upd<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      modelo: form.modelo || null,
      capacidad_gb: form.capacidad_gb ? Number(form.capacidad_gb) : null,
      color: form.color || null,
      imei: form.imei || null,
      bateria_porcentaje: form.bateria_porcentaje ? Number(form.bateria_porcentaje) : null,
      estado_estetico: form.estado_estetico || null,
      estado_funcional: form.estado_funcional || null,
      descripcion: form.descripcion || null,
      precio_publicado: form.precio_publicado ? Number(form.precio_publicado) : null,
      tiene_caja: form.tiene_caja,
      tiene_cargador: form.tiene_cargador,
    })
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <form
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Editar publicación #{pub.id_publicacion}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { key: 'modelo', label: 'Modelo', type: 'text' },
              { key: 'capacidad_gb', label: 'Capacidad (GB)', type: 'number' },
              { key: 'color', label: 'Color', type: 'text' },
              { key: 'imei', label: 'IMEI', type: 'text' },
              { key: 'bateria_porcentaje', label: 'Batería (%)', type: 'number' },
              { key: 'precio_publicado', label: 'Precio ($)', type: 'number' },
            ] as const
          ).map(({ key, label, type }) => (
            <label key={key} className="flex flex-col gap-1 text-xs font-semibold text-gray-500">
              {label}
              <input
                type={type}
                value={form[key] as string}
                onChange={(e) => upd(key, e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-gray-400"
              />
            </label>
          ))}

          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-500">
            Estado estético
            <select
              value={form.estado_estetico}
              onChange={(e) => upd('estado_estetico', e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-gray-400"
            >
              <option value="">—</option>
              <option value="excelente">Excelente</option>
              <option value="muy_bueno">Muy bueno</option>
              <option value="bueno">Bueno</option>
              <option value="regular">Regular</option>
              <option value="malo">Malo</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-500">
            Estado funcional
            <select
              value={form.estado_funcional}
              onChange={(e) => upd('estado_funcional', e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-gray-400"
            >
              <option value="">—</option>
              <option value="perfecto">Perfecto</option>
              <option value="bueno">Bueno</option>
              <option value="con_fallas">Con fallas</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-500">
          Descripción
          <textarea
            rows={3}
            value={form.descripcion}
            onChange={(e) => upd('descripcion', e.target.value)}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-gray-400 resize-none"
          />
        </label>

        <div className="flex gap-5">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.tiene_caja}
              onChange={(e) => upd('tiene_caja', e.target.checked)}
              className="rounded"
            />
            Incluye caja
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.tiene_cargador}
              onChange={(e) => upd('tiene_cargador', e.target.checked)}
              className="rounded"
            />
            Incluye cargador
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
            Cancelar
          </button>
          <button type="submit" disabled={isBusy} className="btn btn-primary btn-sm">
            {isBusy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PublicacionesPage() {
  const [filtro, setFiltro] = useState<EstadoFiltro>('pendiente_revision')
  const [selected, setSelected] = useState<Publicacion | null>(null)
  const [editando, setEditando] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: rows = [], isLoading: loadingPubs, error: pubsError } = usePublicaciones()
  const { data: intereses = [], isLoading: loadingInts } = useIntereses()
  const cambiarEstado = useCambiarEstadoPublicacion()
  const eliminarPub = useEliminarPublicacion()
  const editarPub = useEditarPublicacion()

  const loading = loadingPubs || loadingInts
  const error =
    actionError ?? (pubsError ? (pubsError instanceof Error ? pubsError.message : 'Error') : null)

  const rowsFiltradas = useMemo(() => {
    if (filtro === 'todos') return rows
    return rows.filter((r) => (r.estado ?? '').toLowerCase() === filtro)
  }, [filtro, rows])

  function interesesDe(id: number) {
    return intereses.filter((i) => i.id_publicacion === id)
  }

  function handleCambiarEstado(id: number, estado: string) {
    setActionError(null)
    cambiarEstado.mutate(
      { id, estado },
      {
        onSuccess: () => setSelected(null),
        onError: (e) => setActionError(e instanceof Error ? e.message : 'Error al actualizar'),
      },
    )
  }

  function handleEliminar(id: number) {
    if (!window.confirm(`¿Eliminar definitivamente la publicación #${id}? Esta acción no se puede deshacer.`))
      return
    setActionError(null)
    eliminarPub.mutate(id, {
      onSuccess: () => setSelected(null),
      onError: (e) => setActionError(e instanceof Error ? e.message : 'Error al eliminar'),
    })
  }

  function handleEditar(data: Record<string, unknown>) {
    if (!selected) return
    setActionError(null)
    editarPub.mutate(
      { id: selected.id_publicacion, data },
      {
        onSuccess: (updated) => {
          setSelected(updated)
          setEditando(false)
        },
        onError: (e) => setActionError(e instanceof Error ? e.message : 'Error al guardar'),
      },
    )
  }

  const isBusy = cambiarEstado.isPending || eliminarPub.isPending || editarPub.isPending

  return (
    <>
      <h1>Marketplace · Publicaciones</h1>
      <p className="lead">
        Panel de administración: aprobá, rechazá y editá publicaciones de usuarios.
      </p>

      {error ? <div className="msg-error">{error}</div> : null}

      {/* Toolbar */}
      <div className="toolbar" style={{ alignItems: 'center' }}>
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
        {!loading && (
          <span className="msg-muted" style={{ fontSize: '0.8rem' }}>
            {rowsFiltradas.length} publicación{rowsFiltradas.length !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {/* Grid de cards */}
      {loading ? (
        <p className="msg-muted">Cargando…</p>
      ) : rowsFiltradas.length === 0 ? (
        <p className="msg-muted">No hay publicaciones para este filtro.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rowsFiltradas.map((p) => (
            <PubCard
              key={p.id_publicacion}
              p={p}
              interesCount={interesesDe(p.id_publicacion).length}
              onClick={() => {
                setSelected(p)
                setEditando(false)
                setActionError(null)
              }}
            />
          ))}
        </div>
      )}

      {/* Modal de detalle */}
      {selected && !editando && (
        <DetalleModal
          pub={selected}
          intereses={interesesDe(selected.id_publicacion)}
          onClose={() => setSelected(null)}
          onAccion={(estado) => handleCambiarEstado(selected.id_publicacion, estado)}
          onEditar={() => setEditando(true)}
          onEliminar={() => handleEliminar(selected.id_publicacion)}
          isBusy={isBusy}
        />
      )}

      {/* Modal de edición */}
      {selected && editando && (
        <EditarModal
          pub={selected}
          onClose={() => setEditando(false)}
          onSave={handleEditar}
          isBusy={isBusy}
        />
      )}
    </>
  )
}
