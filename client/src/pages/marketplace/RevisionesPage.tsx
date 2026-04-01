import { useCallback, useEffect, useState } from 'react'
import type { Publicacion, RevisionPublicacion } from '../../types/marketplace'
import { marketplaceApi } from '../../services/marketplaceApi'

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

const emptyForm = {
  id_publicacion: '' as string | number,
  estado_revision: '',
  observaciones: '',
}

export function RevisionesPage() {
  const [rows, setRows] = useState<RevisionPublicacion[]>([])
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [revs, pubs] = await Promise.all([
        marketplaceApi.revisiones.list(0, 100),
        marketplaceApi.publicaciones.list(0, 100, null),
      ])
      setRows(revs)
      setPublicaciones(pubs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const pubLabel = (id: number) => {
    const p = publicaciones.find((x) => x.id_publicacion === id)
    if (!p) return `#${id}`
    const t = p.titulo ?? p.modelo ?? ''
    return t ? `#${id} · ${t}` : `#${id}`
  }

  function startEdit(r: RevisionPublicacion) {
    setEditingId(r.id_revision)
    setForm({
      id_publicacion: r.id_publicacion,
      estado_revision: r.estado_revision ?? '',
      observaciones: r.observaciones ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const idPub = Number(form.id_publicacion)
    if (!Number.isFinite(idPub) || idPub < 1) {
      setError('Elegí una publicación válida.')
      return
    }
    const body = {
      id_publicacion: idPub,
      estado_revision: form.estado_revision.trim() || null,
      observaciones: form.observaciones.trim() || null,
    }
    try {
      if (editingId != null) {
        await marketplaceApi.revisiones.patch(editingId, {
          estado_revision: body.estado_revision,
          observaciones: body.observaciones,
        })
      } else {
        await marketplaceApi.revisiones.create(body)
      }
      cancelEdit()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar esta revisión?')) return
    setError(null)
    try {
      await marketplaceApi.revisiones.delete(id)
      if (editingId === id) cancelEdit()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  return (
    <>
      <h1>Revisiones de publicaciones</h1>
      <p className="lead">
        Moderación: cada revisión queda asociada a una publicación. Podés
        registrar aprobación, rechazo u observaciones.
      </p>

      {error ? <div className="msg-error">{error}</div> : null}

      <div className="panel">
        <h2>{editingId != null ? 'Editar revisión' : 'Nueva revisión'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Publicación
              <select
                value={form.id_publicacion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, id_publicacion: e.target.value }))
                }
                required
                disabled={editingId != null}
              >
                <option value="">Seleccionar…</option>
                {publicaciones.map((p) => (
                  <option key={p.id_publicacion} value={p.id_publicacion}>
                    {pubLabel(p.id_publicacion)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Estado de revisión
              <input
                placeholder="aprobada, rechazada…"
                value={form.estado_revision}
                onChange={(e) =>
                  setForm((f) => ({ ...f, estado_revision: e.target.value }))
                }
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Observaciones
              <textarea
                value={form.observaciones}
                onChange={(e) =>
                  setForm((f) => ({ ...f, observaciones: e.target.value }))
                }
              />
            </label>
          </div>
          <div className="toolbar" style={{ marginTop: '0.75rem' }}>
            <button type="submit" className="btn btn-primary">
              {editingId != null ? 'Guardar' : 'Registrar revisión'}
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
          <p className="msg-muted">No hay revisiones registradas.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Publicación</th>
                  <th>Estado revisión</th>
                  <th>Fecha</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id_revision}>
                    <td>{r.id_revision}</td>
                    <td>{pubLabel(r.id_publicacion)}</td>
                    <td>{r.estado_revision ?? '—'}</td>
                    <td>{fmtFecha(r.fecha_revision)}</td>
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
                        onClick={() => void handleDelete(r.id_revision)}
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
