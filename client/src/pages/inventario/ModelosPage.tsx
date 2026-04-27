import { useCallback, useEffect, useRef, useState } from 'react'
import type { ModeloAtributo, ModeloEquipo } from '../../types/inventario'
import { inventarioApi } from '../../services/inventarioApi'

const VARIATION_PRESETS = [
  { code: 'color', label: 'Color', tipo_ui: 'swatch' },
  { code: 'almacenamiento', label: 'GB / Almacenamiento', tipo_ui: 'chip' },
]

const emptyForm = { nombre_modelo: '', descripcion: '', activo: true }

type FormState = typeof emptyForm

// ——— Skeleton row ———
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

// ——— Modal wrapper ———
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

export function ModelosPage() {
  const [rows, setRows] = useState<ModeloEquipo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  // Attributes (managed after model is saved)
  const [attrsByModel, setAttrsByModel] = useState<Record<number, ModeloAtributo[]>>({})
  const [newOptionByAttr, setNewOptionByAttr] = useState<Record<number, string>>({})
  const [attrBusy, setAttrBusy] = useState(false)

  // Per-row busy state for delete
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set())

  function flashSuccess(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 2800)
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

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
    setError(null)
  }

  function openEdit(m: ModeloEquipo) {
    setEditingId(m.id)
    setForm({ nombre_modelo: m.nombre_modelo, descripcion: m.descripcion ?? '', activo: m.activo })
    setModalOpen(true)
    setError(null)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const body = {
      nombre_modelo: form.nombre_modelo.trim(),
      capacidad_gb: null,
      descripcion: form.descripcion.trim() || null,
      activo: form.activo,
    }
    if (!body.nombre_modelo) { setError('El nombre del modelo es obligatorio.'); return }
    setSaving(true)
    try {
      const saved =
        editingId != null
          ? await inventarioApi.modelos.patch(editingId, body)
          : await inventarioApi.modelos.create(body)

      // Optimistic update in list
      setRows((prev) => {
        if (editingId != null) {
          return prev.map((r) => (r.id === editingId ? { ...r, ...saved } : r))
        }
        return [...prev, { ...saved, atributos: [] }]
      })

      // Open editing mode for the new model so user can add variations
      setEditingId(saved.id)
      setForm({ nombre_modelo: saved.nombre_modelo, descripcion: saved.descripcion ?? '', activo: saved.activo })

      flashSuccess(editingId != null ? 'Modelo actualizado.' : 'Modelo creado. Ahora podés agregar variaciones.')
      // Refresh attrs
      await reloadAttrs(saved.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar este modelo? Esta acción no se puede deshacer.')) return
    setError(null)
    // Optimistic remove
    const backup = rows.find((r) => r.id === id)
    setRows((prev) => prev.filter((r) => r.id !== id))
    setBusyIds((prev) => new Set(prev).add(id))
    try {
      await inventarioApi.modelos.delete(id)
      if (editingId === id) closeModal()
      flashSuccess('Modelo eliminado.')
    } catch (e) {
      // Restore on error
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

  async function addPresetAtributo(modelId: number, preset: { code: string; label: string; tipo_ui: string }) {
    setError(null)
    if ((attrsByModel[modelId] ?? []).some((a) => a.code.trim().toLowerCase() === preset.code)) {
      setError(`Ya existe la variación "${preset.label}" en este modelo.`)
      return
    }
    setAttrBusy(true)
    try {
      await inventarioApi.modelos.createAtributo(modelId, {
        code: preset.code, label: preset.label, tipo_ui: preset.tipo_ui, requerido: true, orden: 0, activo: true,
      })
      await reloadAttrs(modelId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar la variación')
    } finally {
      setAttrBusy(false)
    }
  }

  async function deleteAtributo(modelId: number, attr: ModeloAtributo) {
    if (!window.confirm(`¿Eliminar la variación "${attr.label}" y todas sus opciones?`)) return
    setError(null)
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

  const editingAttrs = editingId != null ? (attrsByModel[editingId] ?? []) : []
  const colorExists = editingAttrs.some((a) => a.code.trim().toLowerCase() === 'color')
  const gbExists = editingAttrs.some((a) =>
    a.code.trim().toLowerCase() === 'almacenamiento' || a.code.trim().toLowerCase() === 'gb',
  )

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.25rem' }}>
        <div>
          <h1 className="inv-content h1" style={{ marginBottom: '0.25rem' }}>Modelos de equipo</h1>
          <p className="msg-muted" style={{ marginTop: 0 }}>
            Catálogo de modelos base con sus variaciones de color y almacenamiento.
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
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>
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
              {editingId != null ? `Editar modelo #${editingId}` : 'Nuevo modelo'}
            </h2>
            <button type="button" className="modal-close" onClick={closeModal} aria-label="Cerrar">×</button>
          </div>

          {error ? <div className="msg-error" style={{ marginBottom: '1rem' }}>{error}</div> : null}
          {successMsg ? (
            <div style={{ padding: '0.65rem 0.85rem', borderRadius: 10, background: '#ecfdf3', color: '#027a48', fontSize: '0.88rem', marginBottom: '1rem' }}>
              {successMsg}
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <label style={{ gridColumn: '1 / -1' }}>
                Nombre del modelo
                <input
                  value={form.nombre_modelo}
                  onChange={(e) => setForm((f) => ({ ...f, nombre_modelo: e.target.value }))}
                  placeholder="Ej: iPhone 15 Pro, MacBook Air M3"
                  required
                  autoFocus
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Descripción (opcional)
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Breve descripción del modelo"
                />
              </label>
              <div className="form-row-check" style={{ gridColumn: '1 / -1' }}>
                <input
                  id="activo-mod"
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                />
                <label htmlFor="activo-mod" style={{ fontSize: '0.88rem', color: 'var(--app-text)' }}>
                  Modelo activo
                </label>
              </div>
            </div>

            <div className="modal-footer" style={{ paddingTop: '1rem', borderTop: '1px solid var(--app-border)', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spin" style={{ marginRight: 6 }} />Guardando…</> : editingId != null ? 'Guardar cambios' : 'Crear modelo'}
              </button>
            </div>
          </form>

          {/* Variaciones — solo disponible después de crear el modelo */}
          {editingId != null ? (
            <div className="attr-section">
              <p className="attr-section-title">
                Variaciones del modelo
                {attrBusy ? <span className="spin" style={{ marginLeft: 8 }} /> : null}
              </p>

              <div className="toolbar" style={{ marginBottom: '0.75rem', gap: '0.4rem' }}>
                {!colorExists && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={attrBusy}
                    onClick={() => void addPresetAtributo(editingId, VARIATION_PRESETS[0])}
                  >
                    + Color
                  </button>
                )}
                {!gbExists && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={attrBusy}
                    onClick={() => void addPresetAtributo(editingId, VARIATION_PRESETS[1])}
                  >
                    + Almacenamiento / GB
                  </button>
                )}
                {colorExists && gbExists && editingAttrs.length === 2 && (
                  <span className="msg-muted" style={{ fontSize: '0.82rem' }}>
                    Variaciones base agregadas. Sumá opciones a cada una.
                  </span>
                )}
              </div>

              {editingAttrs.length === 0 ? (
                <p className="msg-muted" style={{ fontSize: '0.85rem' }}>
                  Todavía no hay variaciones. Usá los botones de arriba para agregar Color y/o Almacenamiento.
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
                          <span key={o.id} className="attr-chip">
                            {o.label || o.valor}
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
                        placeholder={attr.code === 'color' ? 'Ej: Negro, Blanco, Azul…' : 'Ej: 128GB, 256GB, 512GB…'}
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
            </div>
          ) : (
            <div className="attr-section" style={{ background: 'var(--app-muted-bg)', border: '1px dashed var(--app-border)' }}>
              <p className="msg-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                Guardá el modelo para empezar a cargar variaciones de color y almacenamiento.
              </p>
            </div>
          )}
        </Modal>
      ) : null}
    </>
  )
}
