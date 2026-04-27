import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EquipoConModelo, ModeloAtributo, ModeloEquipo } from '../../types/inventario'
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

type ModeloApi = Partial<ModeloEquipo> & { id?: number; id_modelo?: number }
type EquipoRow = Partial<EquipoConModelo> & {
  id?: number; id_equipo?: number; id_modelo?: number; modelo?: ModeloApi | null
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('es-AR') } catch { return iso }
}

function parseNumberEsAr(input: string | number): number {
  if (typeof input === 'number') return input
  const raw = String(input).trim()
  if (!raw) return Number.NaN
  return Number(raw.replace(/\./g, '').replace(',', '.'))
}

function fmtArs(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return String(value)
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function fmtUsd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

function attributePriority(code: string | null | undefined): number {
  const n = (code ?? '').trim().toLowerCase()
  if (n === 'color') return 0
  if (n === 'gb' || n === 'almacenamiento' || n === 'storage') return 1
  if (n === 'ram') return 2
  return 10
}

function friendlyAttrLabel(attr: ModeloAtributo): string {
  const n = attr.code.trim().toLowerCase()
  if (n === 'gb' || n === 'almacenamiento' || n === 'storage') return 'GB'
  if (n === 'color') return 'Color'
  return attr.label
}

function buildDefaultOpciones(attrs: ModeloAtributo[]): Record<number, number> {
  const d: Record<number, number> = {}
  for (const a of attrs) {
    const first = (a.opciones ?? []).find((o) => o.activo)
    if (first) d[a.id] = first.id
  }
  return d
}

// ——— Skeleton row ———
function SkeletonRow() {
  return (
    <tr className="skeleton-row">
      <td><span className="skeleton" style={{ width: 40, height: 40, borderRadius: 8, display: 'block' }} /></td>
      <td><span className="skeleton" style={{ width: 140, height: 14 }} /></td>
      <td><span className="skeleton" style={{ width: 60, height: 18, borderRadius: 999 }} /></td>
      <td><span className="skeleton" style={{ width: 80, height: 14 }} /></td>
      <td><span className="skeleton" style={{ width: 60, height: 14 }} /></td>
      <td><span className="skeleton" style={{ width: 50, height: 14 }} /></td>
      <td />
    </tr>
  )
}

// ——— Modal ———
function Modal({ onClose, children, wide }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className={`modal${wide ? ' modal-lg' : ''}`}>{children}</div>
    </div>
  )
}

// ——— Inline IMEIs expand ———
function ImeiRow({ group, busyIds, onEdit, onDelete, onSetFoto, dolarRate, tableCurrency, productosById }: {
  group: { key: string; representative: EquipoRow; units: EquipoRow[] }
  busyIds: Set<number>
  onEdit: (e: EquipoRow) => void
  onDelete: (id: number) => void
  onSetFoto: (id: number) => Promise<void>
  dolarRate: number | null
  tableCurrency: 'ars' | 'usd'
  productosById: Record<number, ProductoCompra>
}) {
  const [expanded, setExpanded] = useState(false)
  const r = group.representative
  const idEquipo = r.id_equipo ?? r.id
  const producto = r.id_producto ? productosById[r.id_producto] : undefined
  const precioDisplay =
    tableCurrency === 'ars'
      ? fmtArs(producto?.precio)
      : producto?.precio != null && dolarRate && dolarRate > 0
        ? fmtUsd(Number(producto.precio) / dolarRate)
        : '—'

  return (
    <>
      <tr className={busyIds.has(idEquipo ?? -1) ? 'row-busy' : ''}>
        <td>
          {r.foto_url ? (
            <img
              src={mediaUrl(r.foto_url)}
              alt=""
              style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border,#e8e8ea)', display: 'block' }}
            />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--app-muted-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--app-muted)" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          )}
        </td>
        <td style={{ fontWeight: 500, color: 'var(--app-text-strong)' }}>
          {r.modelo?.nombre_modelo ?? r.id_modelo ?? '—'}
          {r.color ? (
            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--app-muted)', fontWeight: 400 }}>
              {r.color}
            </span>
          ) : null}
        </td>
        <td>
          <span className="badge badge-info" style={{ textTransform: 'capitalize', fontSize: '0.72rem' }}>
            {r.tipo_equipo ?? '—'}
          </span>
        </td>
        <td style={{ fontSize: '0.85rem' }}>{precioDisplay}</td>
        <td>
          <span className={`badge ${r.activo ? 'badge-on' : 'badge-off'}`}>
            {r.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td style={{ fontSize: '0.82rem', color: 'var(--app-muted)' }}>
          {group.units.length} {group.units.length === 1 ? 'unidad' : 'unidades'}
          {' · '}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Ocultar IMEIs' : 'Ver IMEIs'}
          </button>
        </td>
        <td className="td-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(r)}>
            Editar
          </button>{' '}
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={busyIds.has(idEquipo ?? -1)}
            onClick={() => idEquipo != null && onDelete(idEquipo)}
          >
            {busyIds.has(idEquipo ?? -1) ? <span className="spin" /> : 'Eliminar'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: '0 0.5rem 0.75rem', background: 'var(--app-muted-bg)' }}>
            <div className="table-wrap" style={{ border: '1px solid var(--app-border)', borderRadius: 10, marginTop: '0.5rem' }}>
              <table className="data" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>IMEI</th>
                    <th>Ingreso</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right', paddingRight: '1rem' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {group.units
                    .slice()
                    .sort((a, b) => (b.id_equipo ?? b.id ?? 0) - (a.id_equipo ?? a.id ?? 0))
                    .map((unit) => {
                      const uid = unit.id_equipo ?? unit.id
                      return (
                        <tr key={uid ?? unit.imei ?? 'na'} className={busyIds.has(uid ?? -1) ? 'row-busy' : ''}>
                          <td>{uid ?? '—'}</td>
                          <td style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{unit.imei ?? '—'}</td>
                          <td>{fmtDate(unit.fecha_ingreso)}</td>
                          <td>
                            <span className={`badge ${unit.activo ? 'badge-on' : 'badge-off'}`}>
                              {unit.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="td-actions">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => uid != null && void onSetFoto(uid)}
                              disabled={busyIds.has(uid ?? -1)}
                            >
                              Foto tienda
                            </button>{' '}
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(unit)}>
                              Editar
                            </button>{' '}
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={busyIds.has(uid ?? -1)}
                              onClick={() => uid != null && onDelete(uid)}
                            >
                              {busyIds.has(uid ?? -1) ? <span className="spin" /> : 'Eliminar'}
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
      )}
    </>
  )
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
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    id_modelo: '' as string | number,
    imei: '',
    color: '',
    tipo_equipo: '',
    activo: true,
    precio_ars: '' as string | number,
  })
  const [selectedOpciones, setSelectedOpciones] = useState<Record<number, number>>({})

  const [busyIds, setBusyIds] = useState<Set<number>>(new Set())

  function flashSuccess(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 2800)
  }

  const fotoPreviewUrl = useMemo(() => (fotoFile ? URL.createObjectURL(fotoFile) : ''), [fotoFile])
  useEffect(() => () => { if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl) }, [fotoPreviewUrl])

  useEffect(() => {
    let alive = true
    async function loadDolar() {
      setLoadingDolar(true)
      try {
        const res = await fetch('https://dolarapi.com/v1/dolares/blue')
        const data = (await res.json()) as { venta?: number; fechaActualizacion?: string }
        if (!alive) return
        setDolarRate(typeof data.venta === 'number' && data.venta > 0 ? data.venta : 1100)
        setDolarUpdatedAt(data.fechaActualizacion ?? null)
      } catch { if (alive) { setDolarRate(1100) } }
      finally { if (alive) setLoadingDolar(false) }
    }
    void loadDolar()
    return () => { alive = false }
  }, [])

  const precioUsdCalculado = useMemo(() => {
    const arsRaw = String(form.precio_ars ?? '').trim()
    if (!arsRaw) return ''
    const ars = parseNumberEsAr(arsRaw)
    if (!Number.isFinite(ars) || ars < 0 || !dolarRate || dolarRate <= 0) return ''
    return (ars / dolarRate).toFixed(2)
  }, [form.precio_ars, dolarRate])

  const groupedRows = useMemo(() => {
    const groups = new Map<string, { key: string; representative: EquipoRow; units: EquipoRow[] }>()
    for (const r of rows) {
      const key = [
        r.id_producto ?? 'sin-prod',
        r.id_modelo ?? r.modelo?.id ?? r.modelo?.id_modelo ?? 'sin-modelo',
        (r.tipo_equipo ?? '').trim().toLowerCase(),
        (r.color ?? '').trim().toLowerCase(),
        (r.estado_comercial ?? '').trim().toLowerCase(),
      ].join('|')
      const existing = groups.get(key)
      if (!existing) { groups.set(key, { key, representative: r, units: [r] }); continue }
      existing.units.push(r)
      const prevId = existing.representative.id_equipo ?? existing.representative.id ?? 0
      const currId = r.id_equipo ?? r.id ?? 0
      if (currId < prevId) existing.representative = r
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
      for (const p of productos) index[p.id] = p
      setProductosById(index)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const selectedModelo = useMemo(() => {
    const id = Number(form.id_modelo)
    if (!Number.isFinite(id) || id < 1) return null
    return modelos.find((m) => m.id === id) ?? null
  }, [form.id_modelo, modelos])

  const selectedModeloAtributos = useMemo(() => {
    return [...(selectedModelo?.atributos ?? [])]
      .filter((a) => a.activo)
      .sort((a, b) => {
        const d = attributePriority(a.code) - attributePriority(b.code)
        return d !== 0 ? d : a.orden - b.orden || a.id - b.id
      })
  }, [selectedModelo])

  // Atributos requeridos sin opciones definidas en el modelo (bloquea alta del equipo)
  const missingRequiredAttrs = useMemo(
    () => selectedModeloAtributos.filter((a) => a.requerido && !(a.opciones ?? []).some((o) => o.activo)),
    [selectedModeloAtributos],
  )

  // Atributos requeridos con opciones disponibles pero sin selección del usuario
  const unselectedRequiredAttrs = useMemo(
    () =>
      selectedModeloAtributos.filter(
        (a) => a.requerido && (a.opciones ?? []).some((o) => o.activo) && !selectedOpciones[a.id],
      ),
    [selectedModeloAtributos, selectedOpciones],
  )

  const canSubmit = missingRequiredAttrs.length === 0 && unselectedRequiredAttrs.length === 0

  const selectedColorLabel = useMemo(() => {
    const colorAttr = selectedModeloAtributos.find((a) => a.code.trim().toLowerCase() === 'color')
    if (!colorAttr) return ''
    const opt = colorAttr.opciones?.find((o) => o.id === selectedOpciones[colorAttr.id])
    return opt?.label || opt?.valor || ''
  }, [selectedModeloAtributos, selectedOpciones])

  const currentTipoEquipo = form.tipo_equipo.trim().toLowerCase()
  const tipoEquipoOptions = TIPOS_EQUIPO.some((o) => o.value === currentTipoEquipo)
    ? TIPOS_EQUIPO
    : currentTipoEquipo
      ? [...TIPOS_EQUIPO, { value: currentTipoEquipo, label: form.tipo_equipo.trim() }]
      : TIPOS_EQUIPO

  function openCreate() {
    setEditingId(null)
    setFotoFile(null)
    setForm({ id_modelo: '', imei: '', color: '', tipo_equipo: '', activo: true, precio_ars: '' })
    setSelectedOpciones({})
    setModalOpen(true)
    setError(null)
  }

  function openEdit(e: EquipoRow) {
    const idEquipo = e.id_equipo ?? e.id
    if (!idEquipo) { setError('No se puede editar: el equipo no tiene ID válido.'); return }
    const idModelo = e.modelo?.id ?? e.modelo?.id_modelo ?? e.id_modelo ?? ''
    const producto = e.id_producto ? productosById[e.id_producto] : undefined
    setEditingId(idEquipo)
    setFotoFile(null)
    setForm({
      id_modelo: idModelo,
      imei: e.imei ?? '',
      color: e.color ?? '',
      tipo_equipo: e.tipo_equipo ?? '',
      activo: e.activo ?? true,
      precio_ars: producto?.precio ?? '',
    })
    const configMap: Record<number, number> = {}
    for (const c of e.configuracion ?? []) {
      if (c.id_atributo && c.id_opcion) configMap[c.id_atributo] = c.id_opcion
    }
    setSelectedOpciones(configMap)
    setModalOpen(true)
    setError(null)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setFotoFile(null)
    setError(null)
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    const idModelo = Number(form.id_modelo)
    if (!Number.isFinite(idModelo) || idModelo < 1) { setError('Elegí un modelo válido.'); return }
    if (unselectedRequiredAttrs.length > 0) {
      setError(`Seleccioná una opción para: ${unselectedRequiredAttrs.map((a) => a.label).join(', ')}`)
      return
    }
    const precioArs = form.precio_ars === '' || form.precio_ars === null ? null : parseNumberEsAr(form.precio_ars)
    const precioUsd =
      precioArs !== null && Number.isFinite(precioArs) && dolarRate && dolarRate > 0
        ? precioArs / dolarRate
        : null
    const body: Record<string, unknown> = {
      id_modelo: idModelo,
      imei: form.imei.trim() || null,
      color: form.color.trim() || selectedColorLabel || null,
      tipo_equipo: form.tipo_equipo.trim().toLowerCase() || null,
      activo: form.activo,
      opciones_configuracion_ids: Object.values(selectedOpciones),
    }
    if (editingId == null) body.estado_comercial = 'nuevo'
    if (precioArs !== null && Number.isFinite(precioArs)) body.precio_ars = precioArs
    if (precioUsd !== null && Number.isFinite(precioUsd)) body.precio_usd = precioUsd
    setSaving(true)
    try {
      if (editingId != null) {
        await inventarioApi.equipos.patch(editingId, body)
        if (fotoFile) await inventarioApi.equipos.uploadFoto(editingId, fotoFile)
      } else {
        const created = await inventarioApi.equipos.create(body)
        const createdId = created.id_equipo ?? created.id
        if (fotoFile && createdId != null) await inventarioApi.equipos.uploadFoto(createdId, fotoFile)
      }
      flashSuccess(editingId != null ? 'Equipo actualizado.' : 'Equipo creado.')
      closeModal()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar este equipo?')) return
    setError(null)
    const backup = rows.find((r) => (r.id_equipo ?? r.id) === id)
    setRows((prev) => prev.filter((r) => (r.id_equipo ?? r.id) !== id))
    setBusyIds((prev) => new Set(prev).add(id))
    try {
      await inventarioApi.equipos.delete(id)
      if (editingId === id) closeModal()
      flashSuccess('Equipo eliminado.')
    } catch (e) {
      if (backup) setRows((prev) => [...prev, backup])
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    } finally {
      setBusyIds((prev) => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  async function handleSetFoto(uid: number) {
    setBusyIds((prev) => new Set(prev).add(uid))
    try {
      await inventarioApi.equipos.setFotoPrincipalTienda(uid)
      await load()
      flashSuccess('Foto de tienda actualizada.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo establecer la foto principal')
    } finally {
      setBusyIds((prev) => { const s = new Set(prev); s.delete(uid); return s })
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.25rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Equipos</h1>
          <p className="msg-muted" style={{ marginTop: 0 }}>
            Unidades físicas en stock. Cada fila agrupa unidades del mismo modelo, color y tipo.
          </p>
        </div>
        <button type="button" className="btn btn-primary" style={{ flexShrink: 0, marginTop: '0.1rem' }} onClick={openCreate}>
          + Nuevo equipo
        </button>
      </div>

      {error ? <div className="msg-error">{error}</div> : null}
      {successMsg ? (
        <div style={{ padding: '0.65rem 0.85rem', borderRadius: 10, background: '#ecfdf3', color: '#027a48', fontSize: '0.88rem', marginBottom: '1rem' }}>
          {successMsg}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span className="msg-muted" style={{ fontSize: '0.82rem' }}>Precios en:</span>
        <button
          type="button"
          className={`btn btn-sm ${tableCurrency === 'ars' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTableCurrency('ars')}
        >ARS</button>
        <button
          type="button"
          className={`btn btn-sm ${tableCurrency === 'usd' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTableCurrency('usd')}
        >USD</button>
        {!loadingDolar && dolarRate && (
          <span className="msg-muted" style={{ fontSize: '0.78rem' }}>
            Blue: {fmtArs(dolarRate)}
            {dolarUpdatedAt ? ` · ${new Date(dolarUpdatedAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
        )}
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Modelo / Color</th>
                <th>Tipo</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Stock</th>
                <th style={{ textAlign: 'right', paddingRight: '1rem' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} />)
              ) : groupedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--app-muted)', padding: '2rem 1rem' }}>
                    No hay equipos. Creá el primero con el botón de arriba.
                  </td>
                </tr>
              ) : (
                groupedRows.map((group) => (
                  <ImeiRow
                    key={group.key}
                    group={group}
                    busyIds={busyIds}
                    onEdit={openEdit}
                    onDelete={(id) => void handleDelete(id)}
                    onSetFoto={handleSetFoto}
                    dolarRate={dolarRate}
                    tableCurrency={tableCurrency}
                    productosById={productosById}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ——— Modal ——— */}
      {modalOpen ? (
        <Modal onClose={closeModal} wide>
          <div className="modal-header">
            <h2 className="modal-title">
              {editingId != null ? `Editar equipo #${editingId}` : 'Nuevo equipo'}
            </h2>
            <button type="button" className="modal-close" onClick={closeModal} aria-label="Cerrar">×</button>
          </div>

          {error ? <div className="msg-error" style={{ marginBottom: '1rem' }}>{error}</div> : null}

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              {/* Modelo */}
              <label style={{ gridColumn: '1 / -1' }}>
                Modelo
                <select
                  value={form.id_modelo}
                  onChange={(e) => {
                    const nextModelId = Number(e.target.value)
                    const nextModel = modelos.find((m) => m.id === nextModelId) ?? null
                    const nextAttrs = [...(nextModel?.atributos ?? [])]
                      .filter((a) => a.activo)
                      .sort((a, b) => attributePriority(a.code) - attributePriority(b.code) || a.orden - b.orden || a.id - b.id)
                    const defaults = buildDefaultOpciones(nextAttrs)
                    const colorAttr = nextAttrs.find((a) => a.code.trim().toLowerCase() === 'color')
                    const colorOpt = colorAttr ? colorAttr.opciones?.find((o) => o.id === defaults[colorAttr.id]) : null
                    setForm((f) => ({ ...f, id_modelo: e.target.value, color: colorOpt?.label || colorOpt?.valor || '' }))
                    setSelectedOpciones(defaults)
                  }}
                  required
                >
                  <option value="">Seleccionar…</option>
                  {modelos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre_modelo}{m.capacidad_gb != null ? ` · ${m.capacidad_gb} GB` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {/* Variaciones dinámicas */}
              {selectedModeloAtributos.length > 0 && (
                <div style={{ gridColumn: '1 / -1', border: '1px solid var(--app-border)', borderRadius: 12, padding: '0.85rem 1rem', background: 'var(--app-muted-bg)' }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--app-muted)', margin: '0 0 0.65rem' }}>
                    Variaciones de {selectedModelo?.nombre_modelo}
                  </p>
                  {missingRequiredAttrs.length > 0 && (
                    <div className="msg-error" style={{ marginBottom: '0.5rem', fontSize: '0.82rem' }}>
                      Sin opciones definidas para: {missingRequiredAttrs.map((a) => a.label).join(', ')}. Completalas en el modelo.
                    </div>
                  )}
                  {unselectedRequiredAttrs.length > 0 && missingRequiredAttrs.length === 0 && (
                    <div style={{ marginBottom: '0.5rem', fontSize: '0.82rem', padding: '0.5rem 0.7rem', borderRadius: 8, background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
                      Seleccioná una opción para: {unselectedRequiredAttrs.map((a) => a.label).join(', ')}
                    </div>
                  )}
                  <div className="form-grid">
                    {selectedModeloAtributos.map((attr) => (
                      <label key={`attr-${attr.id}`}>
                        {friendlyAttrLabel(attr)}
                        <select
                          value={selectedOpciones[attr.id] ?? ''}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            const option = attr.opciones?.find((o) => o.id === val)
                            setSelectedOpciones((prev) => {
                              const next = { ...prev }
                              if (!Number.isFinite(val) || val < 1) delete next[attr.id]
                              else next[attr.id] = val
                              return next
                            })
                            if (attr.code.trim().toLowerCase() === 'color') {
                              setForm((prev) => ({ ...prev, color: option?.label || option?.valor || '' }))
                            }
                          }}
                          required={!!attr.requerido}
                        >
                          <option value="">Seleccionar…</option>
                          {(attr.opciones ?? []).filter((o) => o.activo).map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label || opt.valor}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label>
                IMEI
                <input
                  value={form.imei}
                  onChange={(e) => setForm((f) => ({ ...f, imei: e.target.value }))}
                  placeholder="Opcional"
                />
              </label>
              <label>
                Color {selectedColorLabel ? `(${selectedColorLabel})` : ''}
                <input
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder={selectedModeloAtributos.some((a) => a.code.trim().toLowerCase() === 'color') ? 'Desde variación' : 'Ej: Negro'}
                />
              </label>
              <label>
                Tipo
                <select
                  value={form.tipo_equipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo_equipo: e.target.value }))}
                  required
                >
                  <option value="">Seleccionar…</option>
                  {tipoEquipoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
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
                  onChange={(e) => setForm((f) => ({ ...f, precio_ars: e.target.value }))}
                  placeholder="Ej: 1500000"
                />
              </label>
              <label>
                Precio (USD) — calculado
                <input type="text" value={precioUsdCalculado} readOnly placeholder="Automático" />
                <span style={{ fontSize: '0.72rem', color: 'var(--app-muted)', marginTop: '0.2rem' }}>
                  Blue: {loadingDolar ? 'cargando…' : dolarRate ? fmtArs(dolarRate) : 'no disp.'}
                </span>
              </label>

              {/* Foto */}
              <label style={{ gridColumn: '1 / -1' }}>
                Foto del equipo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFotoFile(e.target.files?.[0] ?? null)}
                />
                {fotoPreviewUrl ? (
                  <img
                    src={fotoPreviewUrl}
                    alt="Vista previa"
                    style={{ marginTop: '0.5rem', width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border,#e8e8ea)' }}
                  />
                ) : null}
              </label>

              <div className="form-row-check" style={{ gridColumn: '1 / -1' }}>
                <input
                  id="activo-eq"
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                />
                <label htmlFor="activo-eq" style={{ fontSize: '0.88rem' }}>Activo en inventario</label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--app-border)' }}>
              <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || !canSubmit}
              >
                {saving
                  ? <><span className="spin" style={{ marginRight: 6 }} />Guardando…</>
                  : editingId != null ? 'Guardar cambios' : 'Crear equipo'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  )
}
