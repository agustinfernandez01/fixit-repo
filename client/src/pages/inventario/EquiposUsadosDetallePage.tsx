import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EquipoConModelo, EquipoUsadoDetalle, ModeloEquipo } from '../../types/inventario'
import { inventarioApi } from '../../services/inventarioApi'
import { mediaUrl } from '../../services/api'

const TIPOS_EQUIPO = [
  { value: 'iphone', label: 'iPhone' },
  { value: 'ipad', label: 'iPad' },
  { value: 'macbook', label: 'MacBook' },
  { value: 'airpods', label: 'AirPods' },
]

const BATERIA_OPTIONS = [64, 128, 256, 512]
const ESTADO_ESTATICA_OPTIONS = ['Excelente', 'Muy bueno', 'Bueno', 'Detalle leve']
const ESTADO_FUNCIONAL_OPTIONS = ['Excelente', 'Muy bueno', 'Bueno', 'Con detalle']
const DETALLE_PANTALLA_OPTIONS = ['Sin detalle', 'Rayón leve', 'Rayón visible', 'Detalle importante']
const DETALLE_CARCASA_OPTIONS = ['Sin detalle', 'Marcas leves', 'Golpe leve', 'Golpe visible']

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
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatUsdInput(value: number): string {
  if (!Number.isFinite(value)) return ''
  if (value === 0) return '0.00'
  if (Math.abs(value) < 0.01) return value.toFixed(6)
  return value.toFixed(2)
}

export function EquiposUsadosDetallePage() {
  const [rows, setRows] = useState<EquipoUsadoDetalle[]>([])
  const [equipos, setEquipos] = useState<EquipoConModelo[]>([])
  const [modelos, setModelos] = useState<ModeloEquipo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [editDetalle, setEditDetalle] = useState<EquipoUsadoDetalle | null>(null)
  const [editForm, setEditForm] = useState({
    color: '',
    precio_ars: '' as string | number,
    bateria_porcentaje: '' as string | number,
    estado_estetico: '',
    estado_funcional: '',
    detalle_pantalla: '',
    detalle_carcasa: '',
    incluye_caja: false,
    incluye_cargador: false,
  })
  const [dolarRate, setDolarRate] = useState<number | null>(null)
  const [loadingDolar, setLoadingDolar] = useState(true)
  const [dolarUpdatedAt, setDolarUpdatedAt] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [editFotoFile, setEditFotoFile] = useState<File | null>(null)
  const [editFotoPreview, setEditFotoPreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    id_modelo: '' as string | number,
    capacidad_gb: '' as string | number,
    imei: '',
    color: '',
    tipo_equipo: '',
    precio_ars: '' as string | number,
    bateria_porcentaje: '' as string | number,
    estado_estetico: '',
    estado_funcional: '',
    detalle_pantalla: '',
    detalle_carcasa: '',
    incluye_caja: false,
    incluye_cargador: false,
  })

  const eqMap = useMemo(
    () =>
      new Map(
        equipos.map((e) => [
          e.id ?? e.id_equipo,
          `${e.modelo?.nombre_modelo ?? 'Equipo'} #${e.id ?? e.id_equipo}${e.imei ? ` · ${e.imei}` : ''}`,
        ]),
      ),
    [equipos],
  )

  const equiposById = useMemo(
    () => new Map(equipos.map((e) => [e.id ?? e.id_equipo, e])),
    [equipos],
  )

  const precioUsdCalculado = useMemo(() => {
    const arsRaw = String(form.precio_ars ?? '').trim()
    if (!arsRaw) return ''
    const ars = parseNumberEsAr(arsRaw)
    if (!Number.isFinite(ars) || ars < 0 || !dolarRate || dolarRate <= 0) return ''
    return formatUsdInput(ars / dolarRate)
  }, [form.precio_ars, dolarRate])

  const selectedModelo = useMemo(
    () => modelos.find((m) => m.id === Number(form.id_modelo)) ?? null,
    [modelos, form.id_modelo],
  )

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [det, eq, mo] = await Promise.all([
        inventarioApi.equiposUsadosDetalle.list(0, 100),
        inventarioApi.equipos.list(0, 100),
        inventarioApi.modelos.list(0, 100),
      ])
      setRows(det)
      setEquipos(eq)
      setModelos(mo.filter((m) => m.activo))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const idModelo = Number(form.id_modelo)
    if (!Number.isFinite(idModelo) || idModelo < 1) {
      setError('Elegí un modelo válido.')
      return
    }
    if (!form.tipo_equipo.trim()) {
      setError('Elegí un tipo de equipo.')
      return
    }
    if (!form.bateria_porcentaje) {
      setError('Elegí una opción de batería.')
      return
    }
    const precioArsRaw = String(form.precio_ars ?? '').trim()
    const precioArs = precioArsRaw === '' ? null : parseNumberEsAr(precioArsRaw)
    if (precioArsRaw !== '' && (!Number.isFinite(precioArs) || (precioArs ?? 0) < 0)) {
      setError('Ingresá un precio ARS válido.')
      return
    }
    const precioUsd =
      precioArs !== null && Number.isFinite(precioArs) && dolarRate && dolarRate > 0
        ? precioArs / dolarRate
        : null
    const capacidadRaw = String(form.capacidad_gb ?? '').trim()
    const capacidadModelo = selectedModelo?.capacidad_gb ?? null
    const capacidadGb =
      capacidadRaw !== ''
        ? Number(capacidadRaw)
        : capacidadModelo != null
          ? Number(capacidadModelo)
          : null
    if (capacidadGb == null || !Number.isFinite(capacidadGb) || capacidadGb <= 0) {
      setError('Ingresá la capacidad en GB para el equipo usado.')
      return
    }

    setSaving(true)
    try {
      const createdEquipo = await inventarioApi.equipos.createUsado({
        id_modelo: idModelo,
        capacidad_gb: capacidadGb,
        imei: form.imei.trim() || null,
        color: form.color.trim() || null,
        tipo_equipo: form.tipo_equipo.trim().toLowerCase(),
        precio_ars: precioArs,
        precio_usd: precioUsd,
        activo: true,
      })
      const idEquipo = createdEquipo.id_equipo ?? createdEquipo.id
      if (!idEquipo) throw new Error('No se pudo obtener el ID del equipo usado creado.')

      if (fotoFile) {
        await inventarioApi.equipos.uploadFoto(idEquipo, fotoFile, { setPrincipalTienda: true })
      }

      await inventarioApi.equiposUsadosDetalle.create({
        id_equipo: idEquipo,
        bateria_porcentaje: Number(form.bateria_porcentaje),
        estado_estetico: form.estado_estetico || null,
        estado_funcional: form.estado_funcional || null,
        detalle_pantalla: form.detalle_pantalla || null,
        detalle_carcasa: form.detalle_carcasa || null,
        incluye_caja: form.incluye_caja,
        incluye_cargador: form.incluye_cargador,
      })

      setForm({
        id_modelo: '',
        capacidad_gb: '',
        imei: '',
        color: '',
        tipo_equipo: '',
        precio_ars: '',
        bateria_porcentaje: '',
        estado_estetico: '',
        estado_funcional: '',
        detalle_pantalla: '',
        detalle_carcasa: '',
        incluye_caja: false,
        incluye_cargador: false,
      })
      setFotoFile(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear equipo usado')
    } finally {
      setSaving(false)
    }
  }

  function pickFoto(file: File | null, setFile: (f: File | null) => void, setPreview: (u: string | null) => void) {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFile(file)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  function startEdit(r: EquipoUsadoDetalle) {
    const equipo = equiposById.get(r.id_equipo)
    setEditDetalle(r)
    setEditFotoFile(null)
    setEditFotoPreview(null)
    setEditForm({
      color: equipo?.color ?? '',
      precio_ars: equipo?.precio_ars ?? '',
      bateria_porcentaje: r.bateria_porcentaje ?? '',
      estado_estetico: r.estado_estetico ?? '',
      estado_funcional: r.estado_funcional ?? '',
      detalle_pantalla: r.detalle_pantalla ?? '',
      detalle_carcasa: r.detalle_carcasa ?? '',
      incluye_caja: r.incluye_caja,
      incluye_cargador: r.incluye_cargador,
    })
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editDetalle) return
    setBusyId(editDetalle.id_detalle_usado)
    setError(null)
    try {
      const precioArs = editForm.precio_ars === '' ? null : parseNumberEsAr(String(editForm.precio_ars))
      const precioUsd =
        precioArs != null && Number.isFinite(precioArs) && dolarRate && dolarRate > 0
          ? precioArs / dolarRate
          : null
      await Promise.all([
        inventarioApi.equipos.patch(editDetalle.id_equipo, {
          color: String(editForm.color).trim() || null,
          precio_ars: precioArs,
          precio_usd: precioUsd,
        }),
        inventarioApi.equiposUsadosDetalle.patch(editDetalle.id_detalle_usado, {
          bateria_porcentaje: editForm.bateria_porcentaje === '' ? null : Number(editForm.bateria_porcentaje),
          estado_estetico: editForm.estado_estetico || null,
          estado_funcional: editForm.estado_funcional || null,
          detalle_pantalla: editForm.detalle_pantalla || null,
          detalle_carcasa: editForm.detalle_carcasa || null,
          incluye_caja: editForm.incluye_caja,
          incluye_cargador: editForm.incluye_cargador,
        }),
      ])
      if (editFotoFile) {
        await inventarioApi.equipos.uploadFoto(editDetalle.id_equipo, editFotoFile, { setPrincipalTienda: true })
      }
      setEditDetalle(null)
      setEditFotoFile(null)
      setEditFotoPreview(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar cambios')
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleActivo(r: EquipoUsadoDetalle) {
    const equipo = equiposById.get(r.id_equipo)
    if (!equipo) return
    setBusyId(r.id_detalle_usado)
    setError(null)
    try {
      await inventarioApi.equipos.patch(r.id_equipo, { activo: !equipo.activo })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeleteFoto(r: EquipoUsadoDetalle) {
    if (!window.confirm('¿Eliminar la foto del equipo?')) return
    setBusyId(r.id_detalle_usado)
    setError(null)
    try {
      await inventarioApi.equipos.deleteFoto(r.id_equipo)
      setEditFotoFile(null)
      setEditFotoPreview(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar foto')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(r: EquipoUsadoDetalle) {
    if (!window.confirm(`¿Eliminar definitivamente el equipo #${r.id_equipo}? Esta acción no se puede deshacer.`)) return
    setBusyId(r.id_detalle_usado)
    setError(null)
    try {
      await inventarioApi.equiposUsadosDetalle.delete(r.id_detalle_usado)
      await inventarioApi.equipos.delete(r.id_equipo)
      if (editDetalle?.id_detalle_usado === r.id_detalle_usado) setEditDetalle(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <h1>Equipos usados</h1>
      <p className="lead">Alta rápida de equipos usados y su detalle en un único formulario.</p>

      {error ? <div className="msg-error">{error}</div> : null}

      <div className="panel">
        <h2>Nuevo equipo usado</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Modelo
              <select
                value={form.id_modelo}
                onChange={(e) =>
                  setForm((f) => {
                    const nextModelId = e.target.value
                    const nextModel = modelos.find((m) => m.id === Number(nextModelId)) ?? null
                    return {
                      ...f,
                      id_modelo: nextModelId,
                      capacidad_gb: nextModel?.capacidad_gb != null ? String(nextModel.capacidad_gb) : '',
                    }
                  })
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
              Capacidad (GB)
              <input
                type="number"
                min={1}
                step={1}
                value={form.capacidad_gb}
                onChange={(e) => setForm((f) => ({ ...f, capacidad_gb: e.target.value }))}
                placeholder="Ej: 128"
                required
              />
            </label>

            <label>
              IMEI
              <input value={form.imei} onChange={(e) => setForm((f) => ({ ...f, imei: e.target.value }))} />
            </label>

            <label>
              Foto del equipo
              <input
                type="file"
                accept="image/*"
                onChange={(e) => pickFoto(e.target.files?.[0] ?? null, setFotoFile, setFotoPreview)}
              />
              {fotoPreview ? (
                <img
                  src={fotoPreview}
                  alt="Vista previa"
                  style={{ marginTop: '0.5rem', width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border,#e8e8ea)', display: 'block' }}
                />
              ) : null}
            </label>

            <label>
              Color
              <input value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} />
            </label>

            <label>
              Tipo
              <select
                value={form.tipo_equipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo_equipo: e.target.value }))}
                required
              >
                <option value="">Seleccionar…</option>
                {TIPOS_EQUIPO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
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
                onChange={(e) => setForm((f) => ({ ...f, precio_ars: e.target.value }))}
                placeholder="Opcional"
              />
            </label>

            <label>
              Precio (USD)
              <input type="text" value={precioUsdCalculado} readOnly placeholder="Se calcula automáticamente" />
            </label>

            <div className="msg-muted" style={{ alignSelf: 'end' }}>
              Cotización API: {loadingDolar ? 'cargando...' : dolarRate ? fmtArs(dolarRate) : 'no disponible'}
              {dolarUpdatedAt ? ` · ${new Date(dolarUpdatedAt).toLocaleString('es-AR')}` : ''}
            </div>

            <label>
              Batería
              <select
                value={form.bateria_porcentaje}
                onChange={(e) => setForm((f) => ({ ...f, bateria_porcentaje: e.target.value }))}
                required
              >
                <option value="">Seleccionar…</option>
                {BATERIA_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Estado estético
              <select
                value={form.estado_estetico}
                onChange={(e) => setForm((f) => ({ ...f, estado_estetico: e.target.value }))}
                required
              >
                <option value="">Seleccionar…</option>
                {ESTADO_ESTATICA_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Estado funcional
              <select
                value={form.estado_funcional}
                onChange={(e) => setForm((f) => ({ ...f, estado_funcional: e.target.value }))}
                required
              >
                <option value="">Seleccionar…</option>
                {ESTADO_FUNCIONAL_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Detalle pantalla
              <select
                value={form.detalle_pantalla}
                onChange={(e) => setForm((f) => ({ ...f, detalle_pantalla: e.target.value }))}
                required
              >
                <option value="">Seleccionar…</option>
                {DETALLE_PANTALLA_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Detalle carcasa
              <select
                value={form.detalle_carcasa}
                onChange={(e) => setForm((f) => ({ ...f, detalle_carcasa: e.target.value }))}
                required
              >
                <option value="">Seleccionar…</option>
                {DETALLE_CARCASA_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-row-check">
              <input
                id="viene-caja"
                type="checkbox"
                checked={form.incluye_caja}
                onChange={(e) => setForm((f) => ({ ...f, incluye_caja: e.target.checked }))}
              />
              <label htmlFor="viene-caja">Viene con caja</label>
            </div>

            <div className="form-row-check">
              <input
                id="viene-cargador"
                type="checkbox"
                checked={form.incluye_cargador}
                onChange={(e) => setForm((f) => ({ ...f, incluye_cargador: e.target.checked }))}
              />
              <label htmlFor="viene-cargador">Viene con cargador</label>
            </div>
          </div>

          <div className="toolbar" style={{ marginTop: '0.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creando…' : 'Crear equipo usado'}
            </button>
          </div>
        </form>
      </div>

      {editDetalle ? (
        <div className="panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2>Editar equipo #{editDetalle.id_equipo}</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditDetalle(null)}>
              Cancelar
            </button>
          </div>
          <form onSubmit={(e) => void handleEditSave(e)}>
            <div className="form-grid">
              <label>
                Color
                <input
                  value={editForm.color}
                  onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
                />
              </label>
              <label>
                Precio (ARS)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editForm.precio_ars}
                  onChange={(e) => setEditForm((f) => ({ ...f, precio_ars: e.target.value }))}
                />
              </label>
              <label>
                Batería
                <select
                  value={editForm.bateria_porcentaje}
                  onChange={(e) => setEditForm((f) => ({ ...f, bateria_porcentaje: e.target.value }))}
                >
                  <option value="">Seleccionar…</option>
                  {BATERIA_OPTIONS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Estado estético
                <select
                  value={editForm.estado_estetico}
                  onChange={(e) => setEditForm((f) => ({ ...f, estado_estetico: e.target.value }))}
                >
                  <option value="">Seleccionar…</option>
                  {ESTADO_ESTATICA_OPTIONS.map((v) => (<option key={v} value={v}>{v}</option>))}
                </select>
              </label>
              <label>
                Estado funcional
                <select
                  value={editForm.estado_funcional}
                  onChange={(e) => setEditForm((f) => ({ ...f, estado_funcional: e.target.value }))}
                >
                  <option value="">Seleccionar…</option>
                  {ESTADO_FUNCIONAL_OPTIONS.map((v) => (<option key={v} value={v}>{v}</option>))}
                </select>
              </label>
              <label>
                Detalle pantalla
                <select
                  value={editForm.detalle_pantalla}
                  onChange={(e) => setEditForm((f) => ({ ...f, detalle_pantalla: e.target.value }))}
                >
                  <option value="">Seleccionar…</option>
                  {DETALLE_PANTALLA_OPTIONS.map((v) => (<option key={v} value={v}>{v}</option>))}
                </select>
              </label>
              <label>
                Detalle carcasa
                <select
                  value={editForm.detalle_carcasa}
                  onChange={(e) => setEditForm((f) => ({ ...f, detalle_carcasa: e.target.value }))}
                >
                  <option value="">Seleccionar…</option>
                  {DETALLE_CARCASA_OPTIONS.map((v) => (<option key={v} value={v}>{v}</option>))}
                </select>
              </label>
              <div className="form-row-check">
                <input
                  id="edit-caja"
                  type="checkbox"
                  checked={editForm.incluye_caja}
                  onChange={(e) => setEditForm((f) => ({ ...f, incluye_caja: e.target.checked }))}
                />
                <label htmlFor="edit-caja">Viene con caja</label>
              </div>
              <div className="form-row-check">
                <input
                  id="edit-cargador"
                  type="checkbox"
                  checked={editForm.incluye_cargador}
                  onChange={(e) => setEditForm((f) => ({ ...f, incluye_cargador: e.target.checked }))}
                />
                <label htmlFor="edit-cargador">Viene con cargador</label>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.5rem' }}>Foto del equipo</p>
                {(() => {
                  const equipo = equiposById.get(editDetalle.id_equipo)
                  const fotoActual = equipo?.foto_url
                  return (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                      {editFotoPreview ? (
                        <img
                          src={editFotoPreview}
                          alt="Nueva foto"
                          style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--app-accent,#111)' }}
                        />
                      ) : fotoActual ? (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <img
                            src={mediaUrl(fotoActual)}
                            alt="Foto actual"
                            style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border,#e8e8ea)', display: 'block' }}
                          />
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            disabled={busyId === editDetalle.id_detalle_usado}
                            onClick={() => void handleDeleteFoto(editDetalle)}
                            style={{ marginTop: '0.35rem', width: '100%' }}
                          >
                            Eliminar foto
                          </button>
                        </div>
                      ) : (
                        <span className="msg-muted" style={{ fontSize: '0.8rem' }}>Sin foto</span>
                      )}
                      <label style={{ margin: 0 }}>
                        {fotoActual && !editFotoPreview ? 'Reemplazar foto' : 'Agregar foto'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => pickFoto(e.target.files?.[0] ?? null, setEditFotoFile, setEditFotoPreview)}
                        />
                        {editFotoPreview ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ marginTop: '0.35rem' }}
                            onClick={() => { setEditFotoFile(null); setEditFotoPreview(null) }}
                          >
                            Cancelar foto
                          </button>
                        ) : null}
                      </label>
                    </div>
                  )
                })()}
              </div>
            </div>
            <div className="toolbar" style={{ marginTop: '0.75rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busyId === editDetalle.id_detalle_usado}
              >
                {busyId === editDetalle.id_detalle_usado ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="panel">
        <h2>Listado de usados</h2>
        {loading ? (
          <p className="msg-muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="msg-muted">No hay usados cargados.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ID detalle</th>
                  <th>Foto</th>
                  <th>Equipo</th>
                  <th>Batería</th>
                  <th>Estético</th>
                  <th>Funcional</th>
                  <th>Pantalla</th>
                  <th>Carcasa</th>
                  <th>Caja</th>
                  <th>Cargador</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const equipo = equiposById.get(r.id_equipo)
                  return (
                    <tr key={r.id_detalle_usado}>
                      <td>{r.id_detalle_usado}</td>
                      <td>
                        {equipo?.foto_url ? (
                          <img
                            src={mediaUrl(equipo.foto_url)}
                            alt={`Equipo ${r.id_equipo}`}
                            style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8 }}
                          />
                        ) : (
                          <span className="msg-muted">—</span>
                        )}
                      </td>
                      <td>{eqMap.get(r.id_equipo) ?? `${equipo?.modelo?.nombre_modelo ?? 'Equipo'} #${r.id_equipo}`}</td>
                      <td>{r.bateria_porcentaje ?? '—'}</td>
                      <td>{r.estado_estetico ?? '—'}</td>
                      <td>{r.estado_funcional ?? '—'}</td>
                      <td>{r.detalle_pantalla ?? '—'}</td>
                      <td>{r.detalle_carcasa ?? '—'}</td>
                      <td>{r.incluye_caja ? 'Sí' : 'No'}</td>
                      <td>{r.incluye_cargador ? 'Sí' : 'No'}</td>
                      <td>
                        <span className={equipo?.activo ? '' : 'msg-muted'}>
                          {equipo?.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === r.id_detalle_usado}
                          onClick={() => startEdit(r)}
                        >
                          Editar
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === r.id_detalle_usado}
                          onClick={() => void handleToggleActivo(r)}
                        >
                          {equipo?.activo ? 'Desactivar' : 'Activar'}
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={busyId === r.id_detalle_usado}
                          onClick={() => void handleDelete(r)}
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
        )}
      </div>
    </>
  )
}
