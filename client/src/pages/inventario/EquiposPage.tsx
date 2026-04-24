import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EquipoConModelo, ModeloEquipo } from '../../types/inventario'
import { inventarioApi } from '../../services/inventarioApi'
import { mediaUrl } from '../../services/api'
import { productosApi } from '../../services/productosApi'
import type { ProductoCompra } from '../../types/carrito'

const TIPOS_EQUIPO = [
  { value: 'iphone', label: 'iPhone' },
  { value: 'ipad', label: 'iPad' },
  { value: 'macbook', label: 'MacBook' },
  { value: 'airpods', label: 'AirPods' },
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

function parseNumberEsAr(input: string | number): number {
  if (typeof input === 'number') return input
  const raw = String(input).trim()
  if (!raw) return Number.NaN

  // Permitir:
  // - "700000"
  // - "700.000" (miles con punto)
  // - "700.000,50" (miles con punto + decimales con coma)
  const normalized = raw.replace(/\./g, '').replace(',', '.')
  return Number(normalized)
}

function fmtArs(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return String(value)
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtUsd(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return String(value)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n)
}

function formatUsdInput(value: number): string {
  if (!Number.isFinite(value)) return ''
  if (value === 0) return '0.00'
  if (Math.abs(value) < 0.01) return value.toFixed(6)
  return value.toFixed(2)
}

export function EquiposPage() {
  const [rows, setRows] = useState<EquipoRow[]>([])
  const [modelos, setModelos] = useState<ModeloEquipo[]>([])
  const [productosById, setProductosById] = useState<Record<number, ProductoCompra>>({})
  const [tableCurrency, setTableCurrency] = useState<'ars' | 'usd'>('ars')
  const [dolarRate, setDolarRate] = useState<number | null>(null)
  const [loadingDolar, setLoadingDolar] = useState(true)
  const [dolarUpdatedAt, setDolarUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    id_modelo: '' as string | number,
    imei: '',
    color: '',
    tipo_equipo: '',
    activo: true,
    precio_ars: '' as string | number,
    precio_usd: '' as string | number,
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

  useEffect(() => {
    let alive = true

    async function loadDolarRate() {
      setLoadingDolar(true)
      try {
        const res = await fetch('https://dolarapi.com/v1/dolares/blue')
        if (!res.ok) throw new Error('No se pudo obtener dolar blue')
        const data = (await res.json()) as { venta?: number; fechaActualizacion?: string }
        if (!alive) return
        if (typeof data.venta === 'number' && data.venta > 0) {
          setDolarRate(data.venta)
          setDolarUpdatedAt(data.fechaActualizacion ?? null)
        } else {
          setDolarRate(1100)
          setDolarUpdatedAt(null)
        }
      } catch {
        if (!alive) return
        setDolarRate(1100)
        setDolarUpdatedAt(null)
      } finally {
        if (alive) setLoadingDolar(false)
      }
    }

    void loadDolarRate()
    return () => {
      alive = false
    }
  }, [])

  const precioUsdCalculado = useMemo(() => {
    const arsRaw = String(form.precio_ars ?? '').trim()
    if (!arsRaw) return ''
    const ars = parseNumberEsAr(arsRaw)
    if (!Number.isFinite(ars) || ars < 0 || !dolarRate || dolarRate <= 0) return ''
    return formatUsdInput(ars / dolarRate)
  }, [form.precio_ars, dolarRate])

  const groupedRows = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; representative: EquipoRow; units: EquipoRow[] }
    >()
    for (const r of rows) {
      const key = [
        r.id_producto ?? 'sin-prod',
        r.id_modelo ?? r.modelo?.id ?? r.modelo?.id_modelo ?? 'sin-modelo',
        (r.tipo_equipo ?? '').trim().toLowerCase(),
        (r.color ?? '').trim().toLowerCase(),
        (r.estado_comercial ?? '').trim().toLowerCase(),
      ].join('|')
      const existing = groups.get(key)
      if (!existing) {
        groups.set(key, { key, representative: r, units: [r] })
        continue
      }
      existing.units.push(r)
      const prevId = existing.representative.id_equipo ?? existing.representative.id ?? 0
      const currId = r.id_equipo ?? r.id ?? 0
      if (currId < prevId) {
        existing.representative = r
      }
    }
    return [...groups.values()].sort((a, b) => {
      const aId = a.representative.id_equipo ?? a.representative.id ?? 0
      const bId = b.representative.id_equipo ?? b.representative.id ?? 0
      return bId - aId
    })
  }, [rows])

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [eq, mo, productos] = await Promise.all([
        inventarioApi.equipos.list(0, 100),
        inventarioApi.modelos.list(0, 100),
        productosApi.list(),
      ])
      setRows(eq as EquipoRow[])
      setModelos(mo.filter((m) => m.activo))
      const index: Record<number, ProductoCompra> = {}
      for (const p of productos) {
        index[p.id] = p
      }
      setProductosById(index)
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
    const producto = e.id_producto ? productosById[e.id_producto] : undefined
    setForm({
      id_modelo: idModelo,
      imei: e.imei ?? '',
      color: e.color ?? '',
      tipo_equipo: e.tipo_equipo ?? '',
      activo: e.activo ?? true,
      precio_ars: producto?.precio ?? '',
      precio_usd: producto?.precio_usd ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setFotoFile(null)
    setForm({
      id_modelo: '',
      imei: '',
      color: '',
      tipo_equipo: '',
      activo: true,
      precio_ars: '',
      precio_usd: '',
    })
  }

  const currentTipoEquipo = form.tipo_equipo.trim().toLowerCase()
  const tipoEquipoOptions = TIPOS_EQUIPO.some(
    (option) => option.value === currentTipoEquipo,
  )
    ? TIPOS_EQUIPO
    : currentTipoEquipo
      ? [...TIPOS_EQUIPO, { value: currentTipoEquipo, label: form.tipo_equipo.trim() }]
      : TIPOS_EQUIPO
  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    const idModelo = Number(form.id_modelo)
    if (!Number.isFinite(idModelo) || idModelo < 1) {
      setError('Elegí un modelo válido.')
      return
    }
    const precioArs =
      form.precio_ars === '' || form.precio_ars === null ? null : parseNumberEsAr(form.precio_ars)
    const precioUsd =
      precioArs !== null && Number.isFinite(precioArs) && dolarRate && dolarRate > 0
        ? precioArs / dolarRate
        : null
    const body: Record<string, unknown> = {
      id_modelo: idModelo,
      imei: form.imei.trim() || null,
      color: form.color.trim() || null,
      tipo_equipo: form.tipo_equipo.trim().toLowerCase() || null,
      activo: form.activo,
    }
    if (editingId == null) {
      // Esta vista es para alta de equipos nuevos.
      body.estado_comercial = 'nuevo'
    }
    if (precioArs !== null && Number.isFinite(precioArs)) body.precio_ars = precioArs
    if (precioUsd !== null && Number.isFinite(precioUsd)) body.precio_usd = precioUsd
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
        cargado en la API. Para variantes de color, cargá una unidad por IMEI
        con su color; en tienda se agrupan por modelo/color.
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
              Color
              <input
                value={form.color}
                onChange={(e) =>
                  setForm((f) => ({ ...f, color: e.target.value }))
                }
                placeholder="Ej: Negro, Blanco, Azul…"
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
              Precio (ARS)
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.precio_ars}
                onChange={(e) => {
                  const arsRaw = e.target.value
                  if (arsRaw === '') {
                    setForm((f) => ({ ...f, precio_ars: '' }))
                    return
                  }
                  const ars = parseNumberEsAr(arsRaw)
                  if (!Number.isFinite(ars) || ars < 0) {
                    setForm((f) => ({ ...f, precio_ars: arsRaw }))
                    return
                  }
                  setForm((f) => ({
                    ...f,
                    precio_ars: arsRaw,
                  }))
                }}
                placeholder="Si dejás vacío, queda en 0"
              />
            </label>
            <label>
              Precio (USD)
              <input
                type="text"
                value={precioUsdCalculado}
                readOnly
                placeholder="Se calcula automáticamente"
              />
            </label>
            <div className="msg-muted" style={{ alignSelf: 'end' }}>
              Cotización API: {loadingDolar ? 'cargando...' : dolarRate ? fmtArs(dolarRate) : 'no disponible'}
              {dolarUpdatedAt ? ` · ${new Date(dolarUpdatedAt).toLocaleString('es-AR')}` : ''}
            </div>
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
        <div className="toolbar" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
          <span className="msg-muted">Moneda:</span>
          <button
            type="button"
            className={`btn btn-sm ${tableCurrency === 'ars' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTableCurrency('ars')}
          >
            ARS
          </button>
          <button
            type="button"
            className={`btn btn-sm ${tableCurrency === 'usd' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTableCurrency('usd')}
          >
            USD
          </button>
        </div>

        {loading ? (
          <p className="msg-muted">Cargando…</p>
        ) : groupedRows.length === 0 ? (
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
                  <th>Estado comercial</th>
                  <th>Precio</th>
                  <th>Ingreso</th>
                  <th>Activo</th>
                  <th>Capacidad</th>
                  <th>Color</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((group) => {
                  const r = group.representative
                  const idEquipo = r.id_equipo ?? r.id
                  const producto = r.id_producto ? productosById[r.id_producto] : undefined
                  const isExpanded = !!expandedGroups[group.key]
                  const unidades = group.units.length
                  return (
                    <>
                      <tr key={`grp-${group.key}`}>
                        <td>{idEquipo ?? '—'}</td>
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
                        <td>{unidades} unidades</td>
                        <td>{r.tipo_equipo ?? '—'}</td>
                        <td>{r.estado_comercial ?? '—'}</td>
                        <td>
                          {tableCurrency === 'ars'
                            ? fmtArs(producto?.precio)
                            : producto?.precio != null && dolarRate && dolarRate > 0
                              ? fmtUsd(Number(producto.precio) / dolarRate)
                              : '—'}
                        </td>
                        <td>{fmtDate(r.fecha_ingreso)}</td>
                        <td>{r.activo ? 'Sí' : 'No'}</td>
                        <td>
                          {r.modelo?.capacidad_gb != null
                            ? `${r.modelo.capacidad_gb} GB`
                            : '—'}
                        </td>
                        <td>{r.color ?? '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              setExpandedGroups((prev) => ({
                                ...prev,
                                [group.key]: !prev[group.key],
                              }))
                            }
                          >
                            {isExpanded ? 'Ocultar IMEIs' : 'Ver IMEIs'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr key={`grp-expanded-${group.key}`}>
                          <td colSpan={12}>
                            <div className="table-wrap" style={{ padding: '0.5rem 0' }}>
                              <table className="data">
                                <thead>
                                  <tr>
                                    <th>ID Equipo</th>
                                    <th>IMEI</th>
                                    <th>Ingreso</th>
                                    <th>Activo</th>
                                    <th>Estado</th>
                                    <th />
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.units
                                    .slice()
                                    .sort((a, b) => (b.id_equipo ?? b.id ?? 0) - (a.id_equipo ?? a.id ?? 0))
                                    .map((unit) => {
                                      const unitId = unit.id_equipo ?? unit.id
                                      return (
                                        <tr key={`unit-${group.key}-${unitId ?? unit.imei ?? 'na'}`}>
                                          <td>{unitId ?? '—'}</td>
                                          <td>{unit.imei ?? '—'}</td>
                                          <td>{fmtDate(unit.fecha_ingreso)}</td>
                                          <td>{unit.activo ? 'Sí' : 'No'}</td>
                                          <td>{unit.estado_comercial ?? '—'}</td>
                                          <td style={{ whiteSpace: 'nowrap' }}>
                                            <button
                                              type="button"
                                              className="btn btn-ghost btn-sm"
                                              onClick={async () => {
                                                if (!unitId) {
                                                  setError('No se puede actualizar foto principal: equipo sin ID.')
                                                  return
                                                }
                                                try {
                                                  await inventarioApi.equipos.setFotoPrincipalTienda(unitId)
                                                  await load()
                                                } catch (e) {
                                                  setError(
                                                    e instanceof Error
                                                      ? e.message
                                                      : 'No se pudo establecer la foto principal de tienda',
                                                  )
                                                }
                                              }}
                                            >
                                              Foto tienda
                                            </button>{' '}
                                            <button
                                              type="button"
                                              className="btn btn-ghost btn-sm"
                                              onClick={() => startEdit(unit)}
                                            >
                                              Editar
                                            </button>{' '}
                                            <button
                                              type="button"
                                              className="btn btn-danger btn-sm"
                                              onClick={() => {
                                                if (!unitId) {
                                                  setError('No se puede eliminar: el equipo no tiene ID válido.')
                                                  return
                                                }
                                                void handleDelete(unitId)
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
                          </td>
                        </tr>
                      ) : null}
                    </>
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
