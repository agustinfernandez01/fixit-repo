import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  Deposito,
  EquipoConModelo,
  EquipoDeposito,
} from '../../types/inventario'
import { inventarioApi } from '../../services/inventarioApi'

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function EquipoDepositoPage() {
  const [rows, setRows] = useState<EquipoDeposito[]>([])
  const [equipos, setEquipos] = useState<EquipoConModelo[]>([])
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    id_equipo: '' as string | number,
    id_deposito: '' as string | number,
  })

  const depMap = useMemo(
    () => new Map(depositos.map((d) => [d.id_deposito, d.nombre])),
    [depositos],
  )
  const eqMap = useMemo(
    () =>
      new Map(
        equipos.map((e) => [
          e.id ?? e.id_equipo,
          `${e.modelo?.nombre_modelo ?? 'Equipo'} #${e.id ?? e.id_equipo}${
            e.imei ? ` · ${e.imei}` : ''
          }`,
        ]),
      ),
    [equipos],
  )

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [ed, eq, dep] = await Promise.all([
        inventarioApi.equipoDeposito.list(0, 100),
        inventarioApi.equipos.list(0, 100),
        inventarioApi.depositos.list(0, 100),
      ])
      setRows(ed)
      setEquipos(eq)
      setDepositos(dep.filter((d) => d.activo))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function startEdit(r: EquipoDeposito) {
    setEditingId(r.id_equipo_deposito)
    setForm({
      id_equipo: r.id_equipo,
      id_deposito: r.id_deposito,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ id_equipo: '', id_deposito: '' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const idE = Number(form.id_equipo)
    const idD = Number(form.id_deposito)
    if (!Number.isFinite(idE) || !Number.isFinite(idD)) {
      setError('Elegí equipo y depósito.')
      return
    }
    const body = { id_equipo: idE, id_deposito: idD }
    try {
      if (editingId != null) {
        await inventarioApi.equipoDeposito.patch(editingId, body)
      } else {
        await inventarioApi.equipoDeposito.create(body)
      }
      cancelEdit()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar esta asignación equipo–depósito?')) return
    setError(null)
    try {
      await inventarioApi.equipoDeposito.delete(id)
      if (editingId === id) cancelEdit()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  return (
    <>
      <h1>Ubicaciones (equipo → depósito)</h1>
      <p className="lead">
        Asigná cada equipo físico a un depósito. Podés tener varios registros
        si el flujo lo requiere (la API no impone unicidad).
      </p>

      {error ? <div className="msg-error">{error}</div> : null}

      <div className="panel">
        <h2>{editingId != null ? 'Editar asignación' : 'Nueva asignación'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Equipo
              <select
                value={form.id_equipo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, id_equipo: e.target.value }))
                }
                required
              >
                <option value="">Seleccionar…</option>
                {equipos.map((x) => (
                  <option key={x.id ?? x.id_equipo} value={x.id ?? x.id_equipo}>
                    {eqMap.get(x.id ?? x.id_equipo)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Depósito
              <select
                value={form.id_deposito}
                onChange={(e) =>
                  setForm((f) => ({ ...f, id_deposito: e.target.value }))
                }
                required
              >
                <option value="">Seleccionar…</option>
                {depositos.map((d) => (
                  <option key={d.id_deposito} value={d.id_deposito}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="toolbar" style={{ marginTop: '0.75rem' }}>
            <button type="submit" className="btn btn-primary">
              {editingId != null ? 'Guardar' : 'Crear'}
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
          <p className="msg-muted">No hay asignaciones.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Equipo</th>
                  <th>Depósito</th>
                  <th>Asignación</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id_equipo_deposito}>
                    <td>{r.id_equipo_deposito}</td>
                    <td>{eqMap.get(r.id_equipo) ?? r.id_equipo}</td>
                    <td>{depMap.get(r.id_deposito) ?? r.id_deposito}</td>
                    <td>{fmtDate(r.fecha_asignacion)}</td>
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
                        onClick={() => void handleDelete(r.id_equipo_deposito)}
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
