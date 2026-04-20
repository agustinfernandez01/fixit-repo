import { useCallback, useEffect, useState } from 'react'
import type { ModeloEquipo } from '../../types/inventario'
import { inventarioApi } from '../../services/inventarioApi'

const emptyForm = {
  nombre_modelo: '',
  capacidad_gb: '' as string | number,
  descripcion: '',
  activo: true,
}

export function ModelosPage() {
  const [rows, setRows] = useState<ModeloEquipo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await inventarioApi.modelos.list(0, 100)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function startEdit(m: ModeloEquipo) {
    setEditingId(m.id)
    setForm({
      nombre_modelo: m.nombre_modelo,
      capacidad_gb: m.capacidad_gb ?? '',
      descripcion: m.descripcion ?? '',
      activo: m.activo,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const capacidad =
      form.capacidad_gb === '' || form.capacidad_gb === null
        ? null
        : Number(form.capacidad_gb)
    const body = {
      nombre_modelo: form.nombre_modelo.trim(),
      capacidad_gb: capacidad,
      descripcion: form.descripcion.trim() || null,
      activo: form.activo,
    }
    if (!body.nombre_modelo) {
      setError('El nombre del modelo es obligatorio.')
      return
    }
    try {
      if (editingId != null) {
        await inventarioApi.modelos.patch(editingId, body)
      } else {
        await inventarioApi.modelos.create(body)
      }
      cancelEdit()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar este modelo?')) return
    setError(null)
    try {
      await inventarioApi.modelos.delete(id)
      if (editingId === id) cancelEdit()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  return (
    <>
      <h1>Modelos de equipo</h1>
      <p className="lead">
        Catálogo de modelos (marca/capacidad/color). Los equipos referencian un
        modelo.
      </p>

      {error ? <div className="msg-error">{error}</div> : null}

      <div className="panel">
        <h2>{editingId != null ? 'Editar modelo' : 'Nuevo modelo'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Nombre
              <input
                value={form.nombre_modelo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nombre_modelo: e.target.value }))
                }
                required
              />
            </label>
            <label>
              Capacidad (GB)
              <input
                type="number"
                min={0}
                value={form.capacidad_gb}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    capacidad_gb: e.target.value,
                  }))
                }
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Descripción
              <textarea
                value={form.descripcion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descripcion: e.target.value }))
                }
              />
            </label>
            <div className="form-row-check">
              <input
                id="activo-modelo"
                type="checkbox"
                checked={form.activo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, activo: e.target.checked }))
                }
              />
              <label htmlFor="activo-modelo">Activo</label>
            </div>
          </div>
          <div className="toolbar" style={{ marginTop: '0.75rem' }}>
            <button type="submit" className="btn btn-primary">
              {editingId != null ? 'Guardar cambios' : 'Crear modelo'}
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
          <p className="msg-muted">No hay modelos. Creá el primero arriba.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>GB</th>
                  <th>Activo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>{m.id}</td>
                    <td>{m.nombre_modelo}</td>
                    <td>{m.capacidad_gb ?? '—'}</td>
                    <td>
                      <span
                        className={`badge ${m.activo ? 'badge-on' : 'badge-off'}`}
                      >
                        {m.activo ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEdit(m)}
                      >
                        Editar
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => void handleDelete(m.id)}
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
