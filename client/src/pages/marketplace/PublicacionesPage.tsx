import { useCallback, useEffect, useState } from 'react'
import { mediaUrl } from '../../services/api'
import type { Publicacion } from '../../types/marketplace'
import { marketplaceApi } from '../../services/marketplaceApi'

const ESTADOS = [
  '',
  'borrador',
  'pendiente_revision',
  'publicada',
  'vendida',
] as const

function fmtPrecio(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

const emptyForm = {
  id_usuario: '' as string | number,
  modelo: '',
  capacidad_gb: '' as string | number,
  color: '',
  imei: '',
  bateria_porcentaje: '' as string | number,
  estado_estetico: '',
  estado_funcional: '',
  titulo: '',
  descripcion: '',
  precio_publicado: '' as string | number,
  estado: '',
  fotos_lines: '',
}

export function PublicacionesPage() {
  const [rows, setRows] = useState<Publicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<string>('')
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await marketplaceApi.publicaciones.list(
        0,
        100,
        filtroEstado || null,
      )
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [filtroEstado])

  useEffect(() => {
    void load()
  }, [load])

  function startEdit(p: Publicacion) {
    setEditingId(p.id_publicacion)
    setForm({
      id_usuario: p.id_usuario,
      modelo: p.modelo ?? '',
      capacidad_gb: p.capacidad_gb ?? '',
      color: p.color ?? '',
      imei: p.imei ?? '',
      bateria_porcentaje: p.bateria_porcentaje ?? '',
      estado_estetico: p.estado_estetico ?? '',
      estado_funcional: p.estado_funcional ?? '',
      titulo: p.titulo ?? '',
      descripcion: p.descripcion ?? '',
      precio_publicado:
        p.precio_publicado === null || p.precio_publicado === undefined
          ? ''
          : String(p.precio_publicado),
      estado: p.estado ?? '',
      fotos_lines: (p.fotos_urls ?? []).join('\n'),
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  function toNullableInt(v: string | number): number | null {
    if (v === '' || v === null || v === undefined) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  function toNullableDecimal(v: string | number): string | number | null {
    if (v === '' || v === null || v === undefined) return null
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v
    return Number.isFinite(n) ? n : null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const fotos_urls = form.fotos_lines
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const bodyBase = {
      modelo: form.modelo.trim() || null,
      capacidad_gb: toNullableInt(form.capacidad_gb),
      color: form.color.trim() || null,
      imei: form.imei.trim() || null,
      bateria_porcentaje: toNullableInt(form.bateria_porcentaje),
      estado_estetico: form.estado_estetico.trim() || null,
      estado_funcional: form.estado_funcional.trim() || null,
      titulo: form.titulo.trim() || null,
      descripcion: form.descripcion.trim() || null,
      precio_publicado: toNullableDecimal(form.precio_publicado),
      estado: form.estado.trim() || null,
      fotos_urls: fotos_urls.length ? fotos_urls : null,
    }

    try {
      if (editingId != null) {
        await marketplaceApi.publicaciones.patch(editingId, bodyBase)
      } else {
        const idU = Number(form.id_usuario)
        if (!Number.isFinite(idU) || idU < 1) {
          setError('El ID de usuario es obligatorio para crear.')
          return
        }
        await marketplaceApi.publicaciones.create({
          id_usuario: idU,
          ...bodyBase,
        })
      }
      cancelEdit()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar esta publicación?')) return
    setError(null)
    try {
      await marketplaceApi.publicaciones.delete(id)
      if (editingId === id) cancelEdit()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  return (
    <>
      <h1>Publicaciones (usados)</h1>
      <p className="lead">
        Avisos del marketplace: datos del equipo, precio y estado del flujo
        (revisión, publicada, vendida).
      </p>

      {error ? <div className="msg-error">{error}</div> : null}

      <div className="toolbar">
        <label className="filter-estado">
          <span className="filter-estado-label">Estado</span>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos</option>
            {ESTADOS.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="panel">
        <h2>{editingId != null ? 'Editar publicación' : 'Nueva publicación'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              ID usuario
              <input
                type="number"
                min={1}
                value={form.id_usuario}
                onChange={(e) =>
                  setForm((f) => ({ ...f, id_usuario: e.target.value }))
                }
                required={editingId == null}
                disabled={editingId != null}
                title={
                  editingId != null
                    ? 'No se puede cambiar desde esta pantalla'
                    : undefined
                }
              />
            </label>
            <label>
              Título
              <input
                value={form.titulo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, titulo: e.target.value }))
                }
              />
            </label>
            <label>
              Estado
              <select
                value={form.estado}
                onChange={(e) =>
                  setForm((f) => ({ ...f, estado: e.target.value }))
                }
              >
                <option value="">(sin definir)</option>
                {ESTADOS.filter(Boolean).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Modelo
              <input
                value={form.modelo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, modelo: e.target.value }))
                }
              />
            </label>
            <label>
              Capacidad (GB)
              <input
                type="number"
                min={0}
                value={form.capacidad_gb}
                onChange={(e) =>
                  setForm((f) => ({ ...f, capacidad_gb: e.target.value }))
                }
              />
            </label>
            <label>
              Color
              <input
                value={form.color}
                onChange={(e) =>
                  setForm((f) => ({ ...f, color: e.target.value }))
                }
              />
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
              Batería (%)
              <input
                type="number"
                min={0}
                max={100}
                value={form.bateria_porcentaje}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    bateria_porcentaje: e.target.value,
                  }))
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
            <label>
              Precio
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={form.precio_publicado}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    precio_publicado: e.target.value,
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
            <label style={{ gridColumn: '1 / -1' }}>
              URLs de fotos (una por línea; ej. /uploads/abc.jpg)
              <textarea
                value={form.fotos_lines}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fotos_lines: e.target.value }))
                }
                placeholder={'/uploads/ejemplo.jpg'}
              />
            </label>
          </div>
          <div className="toolbar" style={{ marginTop: '0.75rem' }}>
            <button type="submit" className="btn btn-primary">
              {editingId != null ? 'Guardar' : 'Crear publicación'}
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
          <p className="msg-muted">No hay publicaciones con este criterio.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Foto</th>
                  <th>Usuario</th>
                  <th>Título</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id_publicacion}>
                    <td>{p.id_publicacion}</td>
                    <td>
                      {p.fotos_urls?.[0] ? (
                        <img
                          src={mediaUrl(p.fotos_urls[0])}
                          alt=""
                          width={40}
                          height={40}
                          style={{
                            objectFit: 'cover',
                            borderRadius: 6,
                            display: 'block',
                          }}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{p.id_usuario}</td>
                    <td>{p.titulo ?? p.modelo ?? '—'}</td>
                    <td>{fmtPrecio(p.precio_publicado)}</td>
                    <td>{p.estado ?? '—'}</td>
                    <td>{fmtFecha(p.fecha_publicacion)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEdit(p)}
                      >
                        Editar
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => void handleDelete(p.id_publicacion)}
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
