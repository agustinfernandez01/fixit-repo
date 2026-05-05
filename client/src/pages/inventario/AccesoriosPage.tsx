import { useCallback, useEffect, useState } from 'react'
import { accesoriosApi } from '../../services/accesoriosApi'
import type { Accesorio } from '../../types/accesorios'

const TIPOS_ACCESORIO = [
  { value: 'funda', label: 'Fundas' },
  { value: 'templado', label: 'Templados' },
  { value: 'cabezal', label: 'Cabezales' },
  { value: 'cable', label: 'Cables' },
]

const emptyForm = {
  tipo: '',
  nombre: '',
  color: '',
  descripcion: '',
  precio: '' as string | number,
  stock: '0' as string | number,
  estado: true,
}

export function AccesoriosPage() {
  const [rows, setRows] = useState<Accesorio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await accesoriosApi.list()
      setRows(data)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al cargar'
      setError(
        message.toLowerCase().includes('failed to fetch')
          ? 'No se pudo conectar al backend de accesorios. Verificá que la API esté levantada.'
          : message,
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function startEdit(row: Accesorio) {
    setEditingId(row.id)
    setForm({
      tipo: row.tipo,
      nombre: row.nombre,
      color: row.color,
      descripcion: row.descripcion,
      precio: '',
      stock: row.stock ?? 0,
      estado: row.estado,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const stockNum = parseInt(String(form.stock).trim(), 10)
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      setError('Ingresá un stock válido (entero ≥ 0).')
      return
    }

    try {
      if (editingId != null) {
        await accesoriosApi.patch(editingId, {
          tipo: form.tipo.trim().toLowerCase(),
          nombre: form.nombre.trim(),
          color: form.color.trim(),
          descripcion: form.descripcion.trim(),
          estado: form.estado,
          stock: stockNum,
        })
      } else {
        const precio = Number(form.precio)
        if (!Number.isFinite(precio) || precio < 0) {
          setError('Ingresá un precio válido.')
          return
        }
        await accesoriosApi.create({
          tipo: form.tipo.trim().toLowerCase(),
          nombre: form.nombre.trim(),
          color: form.color.trim(),
          descripcion: form.descripcion.trim(),
          precio,
          estado: form.estado,
          stock: stockNum,
        })
      }
      cancelEdit()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar este accesorio?')) return
    setError(null)
    try {
      await accesoriosApi.delete(id)
      if (editingId === id) cancelEdit()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  return (
    <>
      <h1>Accesorios</h1>
      <p className="lead">
        Alta y mantenimiento de accesorios. El backend crea el producto del catálogo de forma automática. El{' '}
        <strong>stock</strong> es la cantidad de unidades disponibles para venta (sin IMEI).
      </p>

      {error ? <div className="msg-error">{error}</div> : null}

      <div className="panel">
        <h2>{editingId != null ? 'Editar accesorio' : 'Nuevo accesorio'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Tipo
              <select
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                required
              >
                <option value="">Seleccionar…</option>
                {TIPOS_ACCESORIO.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nombre
              <input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                required
              />
            </label>
            <label>
              Color
              <input
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                required
              />
            </label>
            <label>
              Precio
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.precio}
                onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
                required={editingId == null}
                disabled={editingId != null}
                title={editingId != null ? 'El precio se gestiona desde el producto en inventario si aplica.' : undefined}
              />
            </label>
            <label>
              Stock (unidades)
              <input
                type="number"
                min={0}
                step={1}
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                required
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Descripción
              <textarea
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                required
              />
            </label>
            <div className="form-row-check">
              <input
                id="activo-accesorio"
                type="checkbox"
                checked={form.estado}
                onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
              />
              <label htmlFor="activo-accesorio">Activo</label>
            </div>
          </div>
          <div className="toolbar" style={{ marginTop: '0.75rem' }}>
            <button type="submit" className="btn btn-primary">
              {editingId != null ? 'Guardar' : 'Crear accesorio'}
            </button>
            {editingId != null ? (
              <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
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
          <p className="msg-muted">No hay accesorios.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Stock</th>
                  <th>Tipo</th>
                  <th>Nombre</th>
                  <th>Color</th>
                  <th>Descripción</th>
                  <th>ID producto</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.stock ?? 0}</td>
                    <td>{row.tipo}</td>
                    <td>
                      <strong>{row.nombre}</strong>
                    </td>
                    <td>{row.color}</td>
                    <td>{row.descripcion}</td>
                    <td>{row.id_producto}</td>
                    <td>{row.estado ? 'Sí' : 'No'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(row)}>
                        Editar
                      </button>{' '}
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => void handleDelete(row.id)}>
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