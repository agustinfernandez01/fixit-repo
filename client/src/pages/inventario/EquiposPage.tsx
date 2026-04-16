import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EquipoConModelo, ModeloEquipo } from '../../types/inventario'
import { inventarioApi } from '../../services/inventarioApi'
import { mediaUrl } from '../../services/api'

const TIPOS_EQUIPO = [
  { value: 'iphone', label: 'iPhone' },
  { value: 'ipad', label: 'iPad' },
  { value: 'macbook', label: 'MacBook' },
  { value: 'airpods', label: 'AirPods' },
]

const ESTADOS_COMERCIALES = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'usado', label: 'Usado' },
]

type ModeloApi = Partial<ModeloEquipo> & {
  id?: number
  id_modelo?: number
}

type EquipoRow = Partial<EquipoConModelo> & {
  id?: number
  id_equipo?: number
  id_modelo?: number
  modelo?: ModeloApi | null
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function EquiposPage() {
  const [rows, setRows] = useState<EquipoRow[]>([])
  const [modelos, setModelos] = useState<ModeloEquipo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    id_modelo: '' as string | number,
    imei: '',
    tipo_equipo: '',
    estado_comercial: '',
    activo: true,
    id_producto: '' as string | number,
  })

  const fotoPreview = useMemo(() => {
    if (!fotoFile) return ''
    return URL.createObjectURL(fotoFile)
  }, [fotoFile])

  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    }
  }, [fotoPreview])

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [eq, mo] = await Promise.all([
        inventarioApi.equipos.list(0, 100),
        inventarioApi.modelos.list(0, 100),
      ])
      setRows(eq as EquipoRow[])
      setModelos(mo.filter((m) => m.activo))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function startEdit(e: EquipoRow) {
    const idEquipo = e.id_equipo ?? e.id
    const idModelo = e.modelo?.id ?? e.modelo?.id_modelo ?? e.id_modelo ?? ''

    if (!idEquipo) {
      setError('No se puede editar: el equipo no tiene ID válido.')
      return
    }

    setEditingId(idEquipo)
    setFotoFile(null)
    setForm({
      id_modelo: idModelo,
      imei: e.imei ?? '',
      tipo_equipo: e.tipo_equipo ?? '',
      estado_comercial: e.estado_comercial ?? '',
      activo: e.activo ?? true,
      id_producto: e.id_producto ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setFotoFile(null)
    setForm({
      id_modelo: '',
      imei: '',
      tipo_equipo: '',
      estado_comercial: '',
      activo: true,
      id_producto: '',
    })
  }

  const currentTipoEquipo = form.tipo_equipo.trim().toLowerCase()
  const currentEstadoComercial = form.estado_comercial.trim().toLowerCase()
  const tipoEquipoOptions = TIPOS_EQUIPO.some(
    (option) => option.value === currentTipoEquipo,
  )
    ? TIPOS_EQUIPO
    : currentTipoEquipo
      ? [...TIPOS_EQUIPO, { value: currentTipoEquipo, label: form.tipo_equipo.trim() }]
      : TIPOS_EQUIPO
  const estadoComercialOptions = ESTADOS_COMERCIALES.some(
    (option) => option.value === currentEstadoComercial,
  )
    ? ESTADOS_COMERCIALES
    : currentEstadoComercial
      ? [
          ...ESTADOS_COMERCIALES,
          { value: currentEstadoComercial, label: form.estado_comercial.trim() },
        ]
      : ESTADOS_COMERCIALES

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    const idModelo = Number(form.id_modelo)
    if (!Number.isFinite(idModelo) || idModelo < 1) {
      setError('Elegí un modelo válido.')
      return
    }
    const idProd =
      form.id_producto === '' || form.id_producto === null
        ? null
        : Number(form.id_producto)
    const body: Record<string, unknown> = {
      id_modelo: idModelo,
      imei: form.imei.trim() || null,
      tipo_equipo: form.tipo_equipo.trim().toLowerCase() || null,
      estado_comercial: form.estado_comercial.trim().toLowerCase() || null,
      activo: form.activo,
      id_producto: idProd,
    }
    try {
      if (editingId != null) {
        await inventarioApi.equipos.patch(editingId, body)
        if (fotoFile) {
          await inventarioApi.equipos.uploadFoto(editingId, fotoFile)
        }
      } else {
        const created = await inventarioApi.equipos.create(body)
        const createdId = created.id_equipo ?? created.id
        if (fotoFile && createdId != null) {
          await inventarioApi.equipos.uploadFoto(createdId, fotoFile)
        }
      }
      cancelEdit()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar este equipo?')) return
    setError(null)
    try {
      await inventarioApi.equipos.delete(id)
      if (editingId === id) cancelEdit()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  return (
    <>
      <h1>Equipos</h1>
      <p className="lead">
        Unidades físicas (IMEI, tipo, estado). Cada fila incluye el modelo
        cargado en la API.
      </p>

      {error ? <div className="msg-error">{error}</div> : null}

      <div className="panel">
        <h2>{editingId != null ? 'Editar equipo' : 'Nuevo equipo'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Modelo
              <select
                value={form.id_modelo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, id_modelo: e.target.value }))
                }
                required
              >
                <option value="">Seleccionar…</option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre_modelo}
                    {m.capacidad_gb != null ? ` · ${m.capacidad_gb} GB` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              IMEI
              <input
                value={form.imei}
                onChange={(e) =>
                  setForm((f) => ({ ...f, imei: e.target.value }))
                }
              />
            </label>
            <label>
              Tipo
              <select
                value={form.tipo_equipo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tipo_equipo: e.target.value }))
                }
                required
              >
                <option value="">Seleccionar…</option>
                {tipoEquipoOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Estado comercial
              <select
                value={form.estado_comercial}
                onChange={(e) =>
                  setForm((f) => ({ ...f, estado_comercial: e.target.value }))
                }
                required
              >
                <option value="">Seleccionar…</option>
                {estadoComercialOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ID producto (catálogo)
              <input
                type="number"
                min={1}
                value={form.id_producto}
                onChange={(e) =>
                  setForm((f) => ({ ...f, id_producto: e.target.value }))
                }
              />
            </label>
            <label>
              Foto del equipo
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setFotoFile(f)
                }}
              />
              {fotoPreview ? (
                <img
                  src={fotoPreview}
                  alt="Vista previa"
                  style={{
                    marginTop: '0.5rem',
                    width: '120px',
                    height: '120px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #e6e6e6)',
                  }}
                />
              ) : null}
            </label>
            <div className="form-row-check">
              <input
                id="activo-eq"
                type="checkbox"
                checked={form.activo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, activo: e.target.checked }))
                }
              />
              <label htmlFor="activo-eq">Activo</label>
            </div>
          </div>
          <div className="toolbar" style={{ marginTop: '0.75rem' }}>
            <button type="submit" className="btn btn-primary">
              {editingId != null ? 'Guardar' : 'Crear equipo'}
            </button>
            {editingId != null ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelEdit}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>Listado</h2>

        {loading ? (
          <p className="msg-muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="msg-muted">No hay equipos.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>ID producto</th>
                  <th>Foto</th>
                  <th>Modelo</th>
                  <th>IMEI</th>
                  <th>Tipo</th>
                  <th>Estado comercial</th>
                  <th>Ingreso</th>
                  <th>Activo</th>
                  <th>Capacidad</th>
                  <th>Color</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const idEquipo = r.id_equipo ?? r.id
                  return (
                    <tr key={idEquipo ?? `${r.id_producto ?? 'eq'}-${r.imei ?? 'sin-imei'}`}>
                      <td>{idEquipo ?? '—'}</td>
                      <td>{r.id_producto ?? '—'}</td>
                      <td>
                        {r.foto_url ? (
                          <img
                            src={mediaUrl(r.foto_url)}
                            alt={`Equipo ${idEquipo ?? '—'}`}
                            style={{
                              width: '44px',
                              height: '44px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '1px solid var(--border, #e6e6e6)',
                            }}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{r.modelo?.nombre_modelo ?? r.id_modelo ?? '—'}</td>
                      <td>{r.imei ?? '—'}</td>
                      <td>{r.tipo_equipo ?? '—'}</td>
                      <td>{r.estado_comercial ?? '—'}</td>
                      <td>{fmtDate(r.fecha_ingreso)}</td>
                      <td>{r.activo ? 'Sí' : 'No'}</td>
                      <td>
                        {r.modelo?.capacidad_gb != null
                          ? `${r.modelo.capacidad_gb} GB`
                          : '—'}
                      </td>
                      <td>{r.modelo?.color ?? '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => startEdit(r)}
                        >
                          Editar
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            if (!idEquipo) {
                              setError('No se puede eliminar: el equipo no tiene ID válido.')
                              return
                            }
                            void handleDelete(idEquipo)
                          }}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
