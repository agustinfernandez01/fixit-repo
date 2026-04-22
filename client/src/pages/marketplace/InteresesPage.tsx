import { useCallback, useEffect, useState } from 'react'
import { marketplaceApi } from '../../services/marketplaceApi'
import type { InteresPublicacion } from '../../types/marketplace'

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function InteresesPage() {
  const [rows, setRows] = useState<InteresPublicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await marketplaceApi.intereses.list(0, 100)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar intereses')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function marcarContactado(idInteres: number) {
    setBusyId(idInteres)
    setError(null)
    try {
      await marketplaceApi.intereses.patch(idInteres, { estado: 'contactado' })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el interés')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <h1>Intereses de Marketplace</h1>
      <p className="lead">Avisos de clientes interesados en publicaciones del marketplace.</p>

      {error ? <div className="msg-error">{error}</div> : null}

      <div className="panel">
        <h2>Listado</h2>
        {loading ? (
          <p className="msg-muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="msg-muted">No hay intereses registrados.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Publicación</th>
                  <th>Comprador</th>
                  <th>Mensaje</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id_interes}>
                    <td>{r.id_interes}</td>
                    <td>{r.publicacion_titulo ?? r.publicacion_modelo ?? `#${r.id_publicacion}`}</td>
                    <td>
                      <div>{r.comprador_nombre ?? `Usuario #${r.id_usuario_interesado}`}</div>
                      <div className="msg-muted">{r.comprador_email ?? r.comprador_telefono ?? '—'}</div>
                    </td>
                    <td>{r.mensaje ?? '—'}</td>
                    <td>{r.estado ?? '—'}</td>
                    <td>{fmtFecha(r.fecha_interes)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busyId === r.id_interes || (r.estado ?? '').toLowerCase() === 'contactado'}
                        onClick={() => void marcarContactado(r.id_interes)}
                      >
                        {busyId === r.id_interes ? 'Guardando…' : 'Marcar contactado'}
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
