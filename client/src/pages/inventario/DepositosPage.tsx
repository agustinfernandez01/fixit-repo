import { useCallback, useEffect, useState } from 'react'
import type { Deposito } from '../../types/inventario'
import { inventarioApi } from '../../services/inventarioApi'

const empty = {
  nombre: '',
  direccion: '',
  descripcion: '',
  activo: true,
}

export function DepositosPage() {
  const [rows, setRows] = useState<Deposito[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(empty)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await inventarioApi.depositos.list(0, 100)
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

  function startEdit(d: Deposito) {
    setEditingId(d.id_deposito)
    setForm({
      nombre: d.nombre,
      direccion: d.direccion ?? '',
      descripcion: d.descripcion ?? '',
      activo: d.activo,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(empty)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const body = {
      nombre: form.nombre.trim(),
      direccion: form.direccion.trim() || null,
      descripcion: form.descripcion.trim() || null,
      activo: form.activo,
    }
    if (!body.nombre) {
      setError('El nombre del depósito es obligatorio.')
      return
    }
    try {
      if (editingId != null) {
        await inventarioApi.depositos.patch(editingId, body)
      } else {
        await inventarioApi.depositos.create(body)
      }
      cancelEdit()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar este depósito?')) return
    setError(null)
    try {
      await inventarioApi.depositos.delete(id)
      if (editingId === id) cancelEdit()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  return (
    <>
      <h1>Depósitos</h1>
      <p className="lead">
        Ubicaciones físicas donde puede haber stock (tienda, depósito central,
        etc.).
      </p>

      {error ? <div className="msg-error">{error}</div> : null}

      <div className="panel">
        <h2>{editingId != null ? 'Editar depósito' : 'Nuevo depósito'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Nombre
              <input
                value={form.nombre}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nombre: e.target.value }))
                }
                required
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Dirección
              <input
                value={form.direccion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, direccion: e.target.value }))
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
                id="activo-dep"
                type="checkbox"
                checked={form.activo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, activo: e.target.checked }))
                }
              />
              <label htmlFor="activo-dep">Activo</label>
            </div>
          </div>
          <div className="toolbar" style={{ marginTop: '0.75rem' }}>
            <button type="submit" className="btn btn-primary">
              {editingId != null ? 'Guardar' : 'Crear depósito'}
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
          <p className="msg-muted">No hay depósitos.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Dirección</th>
                  <th>Activo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id_deposito}>
                    <td>{d.id_deposito}</td>
                    <td>{d.nombre}</td>
                    <td>{d.direccion ?? '—'}</td>
                    <td>
                      <span
                        className={`badge ${d.activo ? 'badge-on' : 'badge-off'}`}
                      >
                        {d.activo ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEdit(d)}
                      >
                        Editar
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => void handleDelete(d.id_deposito)}
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
