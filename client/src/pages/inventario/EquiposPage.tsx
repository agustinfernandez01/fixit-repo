import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EquipoConModelo, ModeloEquipo } from '../../types/inventario'
import { inventarioApi } from '../../services/inventarioApi'
import { mediaUrl } from '../../services/api'

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function EquiposPage() {
  const [rows, setRows] = useState<EquipoConModelo[]>([])
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
      setRows(eq)
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

  function startEdit(e: EquipoConModelo) {
    setEditingId(e.id_equipo)
    setFotoFile(null)
    setForm({
      id_modelo: e.id_modelo,
      imei: e.imei ?? '',
      tipo_equipo: e.tipo_equipo ?? '',
      estado_comercial: e.estado_comercial ?? '',
      activo: e.activo,
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
      tipo_equipo: form.tipo_equipo.trim() || null,
      estado_comercial: form.estado_comercial.trim() || null,
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
        if (fotoFile) {
          await inventarioApi.equipos.uploadFoto(created.id_equipo, fotoFile)
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
                  <option key={m.id_modelo} value={m.id_modelo}>
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
              <input
                placeholder="smartphone, usado…"
                value={form.tipo_equipo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tipo_equipo: e.target.value }))
                }
              />
            </label>
            <label>
              Estado comercial
              <input
                placeholder="nuevo, usado…"
                value={form.estado_comercial}
                onChange={(e) =>
                  setForm((f) => ({ ...f, estado_comercial: e.target.value }))
                }
              />
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
                  <th>Foto</th>
                  <th>Modelo</th>
                  <th>IMEI</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Ingreso</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id_equipo}>
                    <td>{r.id_equipo}</td>
                    <td>
                      {r.foto_url ? (
                        <img
                          src={mediaUrl(r.foto_url)}
                          alt={`Equipo ${r.id_equipo}`}
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
                    <td>{r.modelo?.nombre_modelo ?? r.id_modelo}</td>
                    <td>{r.imei ?? '—'}</td>
                    <td>{r.tipo_equipo ?? '—'}</td>
                    <td>{r.estado_comercial ?? '—'}</td>
                    <td>{fmtDate(r.fecha_ingreso)}</td>
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
                        onClick={() => void handleDelete(r.id_equipo)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
