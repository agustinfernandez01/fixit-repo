import { useCallback, useEffect, useRef, useState } from 'react'
import type { ModeloAtributo, ModeloEquipo } from '../../types/inventario'
import { inventarioApi } from '../../services/inventarioApi'
import {
  APPLE_CATALOG,
  composeName,
  fmtStorage,
  type CatalogFamily,
  type CatalogSeries,
  type CatalogVersion,
} from '../../data/appleCatalog'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="skeleton-row">
      <td><span className="skeleton" style={{ width: 24, height: 14 }} /></td>
      <td><span className="skeleton" style={{ width: 160, height: 14 }} /></td>
      <td><span className="skeleton" style={{ width: 60, height: 18, borderRadius: 999 }} /></td>
      <td><span className="skeleton" style={{ width: 80, height: 14 }} /></td>
      <td />
    </tr>
  )
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
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
      <div className="modal modal-lg">
        {children}
      </div>
    </div>
  )
}

// ─── Creación con menús Apple ─────────────────────────────────────────────────

type CreateState = {
  family: CatalogFamily | null
  series: CatalogSeries | null
  version: CatalogVersion | null
  selectedStorages: Set<number>
  selectedColors: Set<string>
}

const emptyCreate: CreateState = {
  family: null,
  series: null,
  version: null,
  selectedStorages: new Set(),
  selectedColors: new Set(),
}

function CreateForm({
  existingNames,
  onCreated,
  onOpenExisting,
}: {
  existingNames: Map<string, number> // nombre_modelo → id
  onCreated: (id: number) => void
  onOpenExisting: (id: number) => void
}) {
  const [state, setState] = useState<CreateState>(emptyCreate)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Fotos por color en estado local; se suben tras crear cada opción.
  const [colorPhotos, setColorPhotos] = useState<Record<string, { file: File; url: string }>>({})
  const colorPhotosRef = useRef(colorPhotos)
  colorPhotosRef.current = colorPhotos

  useEffect(() => () => {
    // Liberar los object URLs al desmontar (ref evita cerrar sobre un valor viejo).
    Object.values(colorPhotosRef.current).forEach((p) => URL.revokeObjectURL(p.url))
  }, [])

  function setColorPhoto(color: string, file: File | null) {
    setColorPhotos((prev) => {
      const next = { ...prev }
      if (prev[color]) URL.revokeObjectURL(prev[color].url)
      if (file) next[color] = { file, url: URL.createObjectURL(file) }
      else delete next[color]
      return next
    })
  }

  const { family, series, version, selectedStorages, selectedColors } = state

  const composedName = family && series && version
    ? composeName(family.label, series.prefix, version.suffix)
    : null

  const existingId = composedName ? (existingNames.get(composedName) ?? null) : null

  function setFamily(f: CatalogFamily | null) {
    setState({ ...emptyCreate, family: f })
  }

  function setSeries(s: CatalogSeries | null) {
    setState((prev) => ({ ...emptyCreate, family: prev.family, series: s }))
  }

  function setVersion(v: CatalogVersion | null) {
    if (!v) {
      setState((prev) => ({ ...prev, version: null, selectedStorages: new Set(), selectedColors: new Set() }))
      return
    }
    // Pre-select all storages and colors from catalog
    setState((prev) => ({
      ...prev,
      version: v,
      selectedStorages: new Set(v.storages),
      selectedColors: new Set(v.colors),
    }))
  }

  function toggleStorage(gb: number) {
    setState((prev) => {
      const next = new Set(prev.selectedStorages)
      next.has(gb) ? next.delete(gb) : next.add(gb)
      return { ...prev, selectedStorages: next }
    })
  }

  function toggleColor(c: string) {
    setState((prev) => {
      const next = new Set(prev.selectedColors)
      next.has(c) ? next.delete(c) : next.add(c)
      return { ...prev, selectedColors: next }
    })
  }

  async function handleCreate() {
    if (!composedName) return
    setError(null)
    setSaving(true)
    try {
      const modelo = await inventarioApi.modelos.create({
        nombre_modelo: composedName,
        capacidad_gb: null,
        descripcion: null,
        activo: true,
      })

      const storagesArr = [...selectedStorages].sort((a, b) => a - b)
      const colorsArr = [...selectedColors]

      if (storagesArr.length > 0) {
        const attr = await inventarioApi.modelos.createAtributo(modelo.id, {
          code: 'almacenamiento', label: 'GB / Almacenamiento', tipo_ui: 'chip',
          requerido: true, orden: 0, activo: true,
        })
        for (let i = 0; i < storagesArr.length; i++) {
          const gb = storagesArr[i]
          await inventarioApi.modelos.createOpcion(attr.id, {
            valor: fmtStorage(gb), label: fmtStorage(gb), orden: i, activo: true,
          })
        }
      }

      if (colorsArr.length > 0) {
        const attr = await inventarioApi.modelos.createAtributo(modelo.id, {
          code: 'color', label: 'Color', tipo_ui: 'swatch',
          requerido: true, orden: 1, activo: true,
        })
        for (let i = 0; i < colorsArr.length; i++) {
          const color = colorsArr[i]
          const opcion = await inventarioApi.modelos.createOpcion(attr.id, {
            valor: color, label: color, orden: i, activo: true,
          })
          const photo = colorPhotos[color]
          if (photo) {
            await inventarioApi.modelos.uploadOpcionFoto(opcion.id, photo.file)
          }
        }
      }

      onCreated(modelo.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear modelo')
    } finally {
      setSaving(false)
    }
  }

  const canCreate = !!composedName && !existingId && (selectedStorages.size > 0 || selectedColors.size > 0)

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 700, color: 'var(--app-muted)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.45rem', display: 'block',
  }
  const chipBtn = (active: boolean): React.CSSProperties => ({
    padding: '0.3rem 0.8rem', borderRadius: 8, cursor: 'pointer', fontWeight: 500,
    fontSize: '0.85rem', transition: 'all 0.1s',
    border: `2px solid ${active ? 'var(--app-ink)' : 'var(--app-border)'}`,
    background: active ? 'var(--app-ink)' : 'transparent',
    color: active ? '#fff' : 'var(--app-text)',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      {error ? <div className="msg-error">{error}</div> : null}

      {/* Fila 1: Tipo */}
      <div>
        <span style={labelStyle}>Tipo de dispositivo</span>
        <div style={{ display: 'flex', gap: '0.45rem' }}>
          {APPLE_CATALOG.map((f) => (
            <button key={f.label} type="button" onClick={() => setFamily(f)}
              style={{
                padding: '0.45rem 1.1rem', borderRadius: 10, cursor: 'pointer',
                fontWeight: 500, fontSize: '0.9rem', transition: 'all 0.12s',
                border: `2px solid ${family?.label === f.label ? 'var(--app-ink)' : 'var(--app-border)'}`,
                background: family?.label === f.label ? 'var(--app-ink)' : 'transparent',
                color: family?.label === f.label ? '#fff' : 'var(--app-text)',
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fila 2: Modelo + Versión en la misma línea */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <span style={labelStyle}>Modelo</span>
          <select
            className="form-select"
            value={series?.label ?? ''}
            disabled={!family}
            onChange={(e) => {
              const found = family!.series.find((s) => s.label === e.target.value) ?? null
              setSeries(found)
            }}
          >
            <option value="">{family ? '— Elegí el modelo —' : '— Primero elegí el tipo —'}</option>
            {(family?.series ?? []).map((s) => (
              <option key={s.label} value={s.label}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <span style={labelStyle}>Versión</span>
          <select
            className="form-select"
            value={version?.label ?? ''}
            disabled={!series}
            onChange={(e) => {
              const found = series!.versions.find((v) => v.label === e.target.value) ?? null
              setVersion(found)
            }}
          >
            <option value="">{series ? '— Elegí la versión —' : '— Primero elegí el modelo —'}</option>
            {(series?.versions ?? []).map((v) => (
              <option key={v.label} value={v.label}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Fila 3: Almacenamiento */}
      <div>
        <span style={labelStyle}>Almacenamiento</span>
        {version ? (
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {version.storages.map((gb) => (
              <button key={gb} type="button" onClick={() => toggleStorage(gb)}
                style={chipBtn(selectedStorages.has(gb))}>
                {fmtStorage(gb)}
              </button>
            ))}
          </div>
        ) : (
          <p className="msg-muted" style={{ fontSize: '0.83rem', margin: 0 }}>
            Seleccioná un modelo y versión para ver las opciones.
          </p>
        )}
      </div>

      {/* Fila 4: Colores */}
      <div>
        <span style={labelStyle}>Colores</span>
        {version ? (
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {version.colors.map((c) => (
              <button key={c} type="button" onClick={() => toggleColor(c)}
                style={chipBtn(selectedColors.has(c))}>
                {c}
              </button>
            ))}
          </div>
        ) : (
          <p className="msg-muted" style={{ fontSize: '0.83rem', margin: 0 }}>
            Seleccioná un modelo y versión para ver los colores.
          </p>
        )}
      </div>

      {/* Fila 4b: Fotos por color (opcional) */}
      {selectedColors.size > 0 && (
        <div>
          <span style={labelStyle}>Fotos por color (opcional)</span>
          <p className="msg-muted" style={{ fontSize: '0.78rem', margin: '0 0 0.6rem' }}>
            La foto de cada color se usa como imagen principal en la tienda para los equipos de ese color.
          </p>
          <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
            {[...selectedColors].map((color) => {
              const photo = colorPhotos[color]
              return (
                <div key={color} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', width: 84 }}>
                  {photo ? (
                    <img loading="lazy"
                      src={photo.url}
                      alt={color}
                      style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--app-border)' }}
                    />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 8, background: 'var(--app-muted-bg)', border: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--app-muted)" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                      </svg>
                    </div>
                  )}
                  <span style={{ fontSize: '0.72rem', textAlign: 'center', color: 'var(--app-text)', lineHeight: 1.1 }}>{color}</span>
                  <label style={{ fontSize: '0.68rem', color: 'var(--app-muted)', cursor: 'pointer', margin: 0 }}>
                    {photo ? 'Cambiar' : 'Subir foto'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => setColorPhoto(color, e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Fila 5: Preview + acción */}
      <div style={{
        marginTop: '0.25rem', padding: '0.85rem 1rem', borderRadius: 10,
        background: !composedName ? 'var(--app-muted-bg)' : existingId ? '#fff7ed' : '#f0fdf4',
        border: `1px solid ${!composedName ? 'var(--app-border)' : existingId ? '#fed7aa' : '#bbf7d0'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '0.75rem', flexWrap: 'wrap',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700,
            color: !composedName ? 'var(--app-muted)' : existingId ? '#92400e' : '#166534',
            textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {!composedName ? 'Completá los campos' : existingId ? '⚠ Ya existe' : '✓ Listo para crear'}
          </p>
          <p style={{ margin: '0.15rem 0 0', fontSize: '1rem', fontWeight: 700, color: 'var(--app-text-strong)' }}>
            {composedName ?? '—'}
          </p>
        </div>
        {existingId ? (
          <button type="button" className="btn btn-ghost btn-sm"
            style={{ borderColor: '#fed7aa' }}
            onClick={() => onOpenExisting(existingId)}>
            Abrir variaciones →
          </button>
        ) : (
          <button type="button" className="btn btn-primary"
            disabled={!canCreate || saving}
            onClick={() => void handleCreate()}>
            {saving
              ? <><span className="spin" style={{ marginRight: 6 }} />Creando…</>
              : 'Crear modelo'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function ModelosPage() {
  const [rows, setRows] = useState<ModeloEquipo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [attrsByModel, setAttrsByModel] = useState<Record<number, ModeloAtributo[]>>({})
  const [newOptionByAttr, setNewOptionByAttr] = useState<Record<number, string>>({})
  const [attrBusy, setAttrBusy] = useState(false)
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set())

  function flashSuccess(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await inventarioApi.modelos.list(0, 100)
      setRows(data)
      const map: Record<number, ModeloAtributo[]> = {}
      for (const m of data) map[m.id] = m.atributos ?? []
      setAttrsByModel(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar modelos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const existingNames = new Map(rows.map((r) => [r.nombre_modelo, r.id]))

  function openCreate() {
    setEditingId(null)
    setModalOpen(true)
    setError(null)
  }

  function openEdit(id: number) {
    setEditingId(id)
    setModalOpen(true)
    setError(null)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setError(null)
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar este modelo? Esta acción no se puede deshacer.')) return
    setError(null)
    const backup = rows.find((r) => r.id === id)
    setRows((prev) => prev.filter((r) => r.id !== id))
    setBusyIds((prev) => new Set(prev).add(id))
    try {
      await inventarioApi.modelos.delete(id)
      if (editingId === id) closeModal()
      flashSuccess('Modelo eliminado.')
    } catch (e) {
      if (backup) setRows((prev) => [...prev, backup].sort((a, b) => a.id - b.id))
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    } finally {
      setBusyIds((prev) => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  async function reloadAttrs(modelId: number) {
    try {
      const attrs = await inventarioApi.modelos.listAtributos(modelId)
      setAttrsByModel((prev) => ({ ...prev, [modelId]: attrs }))
      setRows((prev) => prev.map((r) => (r.id === modelId ? { ...r, atributos: attrs } : r)))
    } catch { /* silent */ }
  }

  async function handleCreated(id: number) {
    await load()
    await reloadAttrs(id)
    setEditingId(id)
    flashSuccess('Modelo creado con variaciones. Podés agregar fotos a cada color.')
  }

  async function deleteAtributo(modelId: number, attr: ModeloAtributo) {
    if (!window.confirm(`¿Eliminar la variación "${attr.label}" y todas sus opciones?`)) return
    setAttrBusy(true)
    try {
      await inventarioApi.modelos.deleteAtributo(attr.id)
      await reloadAttrs(modelId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setAttrBusy(false)
    }
  }

  async function addOpcion(modelId: number, attr: ModeloAtributo) {
    const valor = (newOptionByAttr[attr.id] ?? '').trim()
    if (!valor) return
    setAttrBusy(true)
    try {
      await inventarioApi.modelos.createOpcion(attr.id, {
        valor, label: valor, orden: attr.opciones?.length ?? 0, activo: true,
      })
      setNewOptionByAttr((prev) => ({ ...prev, [attr.id]: '' }))
      await reloadAttrs(modelId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar la opción')
    } finally {
      setAttrBusy(false)
    }
  }

  async function deleteOpcion(modelId: number, optionId: number) {
    setAttrBusy(true)
    try {
      await inventarioApi.modelos.deleteOpcion(optionId)
      await reloadAttrs(modelId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la opción')
    } finally {
      setAttrBusy(false)
    }
  }

  const editingModel = editingId != null ? rows.find((r) => r.id === editingId) : null
  const editingAttrs = editingId != null ? (attrsByModel[editingId] ?? []) : []

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.25rem' }}>
        <div>
          <h1 className="inv-content h1" style={{ marginBottom: '0.25rem' }}>Modelos de equipo</h1>
          <p className="msg-muted" style={{ marginTop: 0 }}>
            Catálogo de modelos Apple con sus variaciones de color y almacenamiento.
          </p>
        </div>
        <button type="button" className="btn btn-primary" style={{ flexShrink: 0, marginTop: '0.1rem' }} onClick={openCreate}>
          + Nuevo modelo
        </button>
      </div>

      {error ? <div className="msg-error">{error}</div> : null}
      {successMsg ? (
        <div style={{ padding: '0.65rem 0.85rem', borderRadius: 10, background: '#ecfdf3', color: '#027a48', fontSize: '0.88rem', marginBottom: '1rem' }}>
          {successMsg}
        </div>
      ) : null}

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Variaciones</th>
                <th style={{ textAlign: 'right', paddingRight: '1rem' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} />)
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--app-muted)', padding: '2rem 1rem' }}>
                    No hay modelos. Creá el primero con el botón de arriba.
                  </td>
                </tr>
              ) : (
                rows.map((m) => {
                  const attrs = attrsByModel[m.id] ?? []
                  const totalOpciones = attrs.reduce((sum, a) => sum + (a.opciones?.length ?? 0), 0)
                  const isBusy = busyIds.has(m.id)
                  return (
                    <tr key={m.id} className={isBusy ? 'row-busy' : ''}>
                      <td style={{ color: 'var(--app-muted)', fontSize: '0.8rem' }}>{m.id}</td>
                      <td style={{ fontWeight: 500, color: 'var(--app-text-strong)' }}>{m.nombre_modelo}</td>
                      <td>
                        <span className={`badge ${m.activo ? 'badge-on' : 'badge-off'}`}>
                          {m.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        {attrs.length === 0 ? (
                          <span className="msg-muted" style={{ fontSize: '0.82rem' }}>Sin variaciones</span>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                            {attrs.map((a) => (
                              <span key={a.id} className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                                {a.label} ({a.opciones?.length ?? 0})
                              </span>
                            ))}
                            {totalOpciones > 0 && (
                              <span className="msg-muted" style={{ fontSize: '0.78rem', alignSelf: 'center' }}>
                                · {totalOpciones} opciones
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="td-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(m.id)}>
                          Editar
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={isBusy}
                          onClick={() => void handleDelete(m.id)}
                        >
                          {isBusy ? <span className="spin" /> : 'Eliminar'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ——— Modal ——— */}
      {modalOpen ? (
        <Modal onClose={closeModal}>
          <div className="modal-header">
            <h2 className="modal-title">
              {editingId != null
                ? `Variaciones · ${editingModel?.nombre_modelo ?? `#${editingId}`}`
                : 'Nuevo modelo Apple'}
            </h2>
            <button type="button" className="modal-close" onClick={closeModal} aria-label="Cerrar">×</button>
          </div>

          {error ? <div className="msg-error" style={{ marginBottom: '1rem' }}>{error}</div> : null}
          {successMsg ? (
            <div style={{ padding: '0.65rem 0.85rem', borderRadius: 10, background: '#ecfdf3', color: '#027a48', fontSize: '0.88rem', marginBottom: '1rem' }}>
              {successMsg}
            </div>
          ) : null}

          {/* ── Modo creación ── */}
          {editingId == null && (
            <CreateForm
              existingNames={existingNames}
              onCreated={(id) => void handleCreated(id)}
              onOpenExisting={(id) => { setEditingId(id) }}
            />
          )}

          {/* ── Modo edición de variaciones ── */}
          {editingId != null && (
            <div className="attr-section" style={{ marginTop: 0 }}>
              <p className="attr-section-title" style={{ marginBottom: '1rem' }}>
                Variaciones cargadas
                {attrBusy ? <span className="spin" style={{ marginLeft: 8 }} /> : null}
              </p>

              {editingAttrs.length === 0 ? (
                <p className="msg-muted" style={{ fontSize: '0.85rem' }}>
                  Sin variaciones. Eliminá y volvé a crear el modelo para regenerarlas.
                </p>
              ) : (
                editingAttrs.map((attr) => (
                  <div key={attr.id} className="attr-row">
                    <div className="attr-row-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="attr-row-label">{attr.label}</span>
                        <span className="attr-row-code">{attr.code}</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={attrBusy}
                        onClick={() => void deleteAtributo(editingId, attr)}
                      >
                        Eliminar
                      </button>
                    </div>

                    <div className="attr-chips">
                      {(attr.opciones ?? []).length === 0 ? (
                        <span className="msg-muted" style={{ fontSize: '0.8rem' }}>Sin opciones aún</span>
                      ) : (
                        (attr.opciones ?? []).map((o) => (
                          <span key={o.id} className="attr-chip" style={{ alignItems: 'flex-start', gap: '0.35rem', padding: '0.3rem 0.5rem' }}>
                            <span style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
                              <span>{o.label || o.valor}</span>
                              {attr.code === 'color' && (
                                <>
                                  {o.foto_url ? (
                                    <img loading="lazy"
                                      src={o.foto_url}
                                      alt={o.label}
                                      style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--app-border)' }}
                                    />
                                  ) : (
                                    <span style={{ fontSize: '0.68rem', color: 'var(--app-muted)' }}>Sin foto</span>
                                  )}
                                  <label style={{ fontSize: '0.68rem', color: 'var(--app-muted)', cursor: 'pointer', margin: 0 }}>
                                    {o.foto_url ? 'Cambiar' : 'Subir foto'}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      style={{ display: 'none' }}
                                      disabled={attrBusy}
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        try {
                                          await inventarioApi.modelos.uploadOpcionFoto(o.id, file)
                                          await reloadAttrs(editingId)
                                        } catch (err) {
                                          setError(err instanceof Error ? err.message : 'Error al subir foto')
                                        }
                                      }}
                                    />
                                  </label>
                                </>
                              )}
                            </span>
                            <button
                              type="button"
                              className="attr-chip-del"
                              disabled={attrBusy}
                              onClick={() => void deleteOpcion(editingId, o.id)}
                              aria-label={`Eliminar opción ${o.label || o.valor}`}
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    <div className="attr-add-row">
                      <input
                        value={newOptionByAttr[attr.id] ?? ''}
                        onChange={(e) => setNewOptionByAttr((prev) => ({ ...prev, [attr.id]: e.target.value }))}
                        placeholder={attr.code === 'color' ? 'Ej: Negro, Blanco…' : 'Ej: 128 GB, 256 GB…'}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addOpcion(editingId, attr) } }}
                        disabled={attrBusy}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={attrBusy || !(newOptionByAttr[attr.id] ?? '').trim()}
                        onClick={() => void addOpcion(editingId, attr)}
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
                ))
              )}

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--app-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingId(null)}
                >
                  ← Crear otro modelo
                </button>
                <button type="button" className="btn btn-ghost" onClick={closeModal}>
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </Modal>
      ) : null}
    </>
  )
}
