import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EquipoConModelo, EquipoUsadoDetalle } from '../../types/inventario'
import { inventarioApi } from '../../services/inventarioApi'

export function EquiposUsadosDetallePage() {
  const [rows, setRows] = useState<EquipoUsadoDetalle[]>([])
  const [equipos, setEquipos] = useState<EquipoConModelo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    id_equipo: '' as string | number,
    bateria_porcentaje: '' as string | number,
    estado_estetico: '',
    estado_funcional: '',
    detalle_pantalla: '',
    detalle_carcasa: '',
    incluye_caja: false,
    incluye_cargador: false,
    observaciones: '',
  })

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
      const [det, eq] = await Promise.all([
        inventarioApi.equiposUsadosDetalle.list(0, 100),
        inventarioApi.equipos.list(0, 100),
      ])
      setRows(det)
      setEquipos(eq)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function startEdit(u: EquipoUsadoDetalle) {
    setEditingId(u.id_detalle_usado)
    setForm({
      id_equipo: u.id_equipo,
      bateria_porcentaje: u.bateria_porcentaje ?? '',
      estado_estetico: u.estado_estetico ?? '',
      estado_funcional: u.estado_funcional ?? '',
      detalle_pantalla: u.detalle_pantalla ?? '',
      detalle_carcasa: u.detalle_carcasa ?? '',
      incluye_caja: u.incluye_caja,
      incluye_cargador: u.incluye_cargador,
      observaciones: u.observaciones ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({
      id_equipo: '',
      bateria_porcentaje: '',
      estado_estetico: '',
      estado_funcional: '',
      detalle_pantalla: '',
      detalle_carcasa: '',
      incluye_caja: false,
      incluye_cargador: false,
      observaciones: '',
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const idE = Number(form.id_equipo)
    if (!Number.isFinite(idE) || idE < 1) {
      setError('Elegí un equipo.')
      return
    }
    const bat =
      form.bateria_porcentaje === '' || form.bateria_porcentaje === null
        ? null
        : Number(form.bateria_porcentaje)
    const body: Record<string, unknown> = {
      id_equipo: idE,
      bateria_porcentaje: bat,
      estado_estetico: form.estado_estetico.trim() || null,
      estado_funcional: form.estado_funcional.trim() || null,
      detalle_pantalla: form.detalle_pantalla.trim() || null,
      detalle_carcasa: form.detalle_carcasa.trim() || null,
      incluye_caja: form.incluye_caja,
      incluye_cargador: form.incluye_cargador,
      observaciones: form.observaciones.trim() || null,
    }
    try {
      if (editingId != null) {
        await inventarioApi.equiposUsadosDetalle.patch(editingId, body)
      } else {
        await inventarioApi.equiposUsadosDetalle.create(body)
      }
      cancelEdit()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar este detalle de usado?')) return
    setError(null)
    try {
      await inventarioApi.equiposUsadosDetalle.delete(id)
      if (editingId === id) cancelEdit()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  return (
    <>
      <h1>Equipos usados — detalle</h1>
      <p className="lead">
        Condición estética/funcional, batería y accesorios. Va asociado a un
        equipo (típicamente <code>tipo_equipo</code> usado).
      </p>

      {error ? <div className="msg-error">{error}</div> : null}

      <div className="panel">
        <h2>{editingId != null ? 'Editar detalle' : 'Nuevo detalle'}</h2>
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
              Batería (%)
              <input
                type="number"
                min={0}
                max={100}
                value={form.bateria_porcentaje}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bateria_porcentaje: e.target.value }))
                }
              />
            </label>
            <label>
              Estado estético
              <input
                value={form.estado_estetico}
                onChange={(e) =>
                  setForm((f) => ({ ...f, estado_estetico: e.target.value }))
                }
              />
            </label>
            <label>
              Estado funcional
              <input
                value={form.estado_funcional}
                onChange={(e) =>
                  setForm((f) => ({ ...f, estado_funcional: e.target.value }))
                }
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Detalle pantalla
              <input
                value={form.detalle_pantalla}
                onChange={(e) =>
                  setForm((f) => ({ ...f, detalle_pantalla: e.target.value }))
                }
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Detalle carcasa
              <input
                value={form.detalle_carcasa}
                onChange={(e) =>
                  setForm((f) => ({ ...f, detalle_carcasa: e.target.value }))
                }
              />
            </label>
            <div className="form-row-check">
              <input
                id="caja"
                type="checkbox"
                checked={form.incluye_caja}
                onChange={(e) =>
                  setForm((f) => ({ ...f, incluye_caja: e.target.checked }))
                }
              />
              <label htmlFor="caja">Incluye caja</label>
            </div>
            <div className="form-row-check">
              <input
                id="cargador"
                type="checkbox"
                checked={form.incluye_cargador}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    incluye_cargador: e.target.checked,
                  }))
                }
              />
              <label htmlFor="cargador">Incluye cargador</label>
            </div>
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
          <p className="msg-muted">No hay registros de detalle usado.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Equipo</th>
                  <th>Bat. %</th>
                  <th>Estético</th>
                  <th>Funcional</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id_detalle_usado}>
                    <td>{r.id_detalle_usado}</td>
                    <td>{eqMap.get(r.id_equipo) ?? r.id_equipo}</td>
                    <td>{r.bateria_porcentaje ?? '—'}</td>
                    <td>{r.estado_estetico ?? '—'}</td>
                    <td>{r.estado_funcional ?? '—'}</td>
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
                        onClick={() => void handleDelete(r.id_detalle_usado)}
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
