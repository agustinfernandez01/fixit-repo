import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { EquipoUsadoDetalle } from '../../types/inventario'
import { inventarioApi } from '../../services/inventarioApi'
import { mediaUrl } from '../../services/api'
import {
  qk,
  useModelos,
  useEquipos,
  useEquiposUsadosDetalle,
  useToggleActivoEquipo,
  useEliminarEquipoUsado,
  useDolarBlue,
} from '../../hooks/queries'

/** Deriva el tipo de equipo (iphone/ipad/macbook/airpods) desde el nombre del modelo. */
function deriveTipoEquipo(nombreModelo: string | null | undefined): string {
  const n = (nombreModelo ?? '').trim().toLowerCase()
  if (n.startsWith('iphone')) return 'iphone'
  if (n.startsWith('ipad')) return 'ipad'
  if (n.startsWith('macbook') || n.startsWith('mac')) return 'macbook'
  if (n.startsWith('airpods')) return 'airpods'
  return ''
}

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

/** Convierte "128 GB" / "1 TB" / "128" / 128 a un entero en GB. Null si no es válido. */
function parseGbToInt(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value) : null
  const raw = value.trim().toLowerCase()
  const num = parseFloat(raw.replace(',', '.'))
  if (!Number.isFinite(num) || num <= 0) return null
  return raw.includes('tb') ? Math.round(num * 1024) : Math.round(num)
}

/** Valores de almacenamiento comunes, para sugerir cuando el modelo no tiene variaciones. */
const GB_COMUNES = [64, 128, 256, 512, 1024]

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

const EMPTY_FORM = {
  nombre_modelo: '',
  id_modelo: '' as string | number,
  capacidad_gb: '' as string | number,
  imei: '',
  color: '',
  precio_ars: '' as string | number,
  bateria_porcentaje: '' as string | number,
  estado_estetico: '',
  estado_funcional: '',
  detalle_pantalla: '',
  detalle_carcasa: '',
  incluye_caja: false,
  incluye_cargador: false,
}


export function EquiposUsadosDetallePage() {
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  // Unified edit state — null means "create mode"
  const [editingIds, setEditingIds] = useState<{ idEquipo: number; idDetalle: number } | null>(null)

  const { data: dolarData, isLoading: loadingDolar } = useDolarBlue()
  const dolarRate = dolarData?.venta ?? null
  const dolarUpdatedAt = dolarData?.fechaActualizacion ?? null

  const [fotoFiles, setFotoFiles] = useState<File[]>([])
  const [fotoPreviews, setFotoPreviews] = useState<string[]>([])
  const [existingFotos, setExistingFotos] = useState<string[]>([])
  const [deleteAllFotosPending, setDeleteAllFotosPending] = useState(false)

  const [form, setForm] = useState(EMPTY_FORM)

  const { data: rows = [], isLoading: loadingRows, error: rowsError } = useEquiposUsadosDetalle()
  const { data: equiposData = [], isLoading: loadingEquipos } = useEquipos()
  const { data: modelosData = [], isLoading: loadingModelos } = useModelos()
  const toggleActivo = useToggleActivoEquipo()
  const eliminarEquipo = useEliminarEquipoUsado()

  const loading = loadingRows || loadingEquipos || loadingModelos
  const error = actionError ?? (rowsError ? (rowsError instanceof Error ? rowsError.message : 'Error al cargar') : null)

  const isEditing = editingIds !== null

  const equipos = equiposData
  const modelos = modelosData.filter((m) => m.activo)

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

  const nombresModelo = useMemo(() => {
    const seen = new Set<string>()
    return modelos
      .map((m) => m.nombre_modelo)
      .filter((name) => {
        if (seen.has(name)) return false
        seen.add(name)
        return true
      })
      .sort()
  }, [modelos])

  const gbOpciones = useMemo(() => {
    const gbAttr = selectedModelo?.atributos?.find((a) => {
      const n = a.code.trim().toLowerCase()
      return n === 'gb' || n === 'almacenamiento' || n === 'storage'
    })
    return (gbAttr?.opciones ?? []).filter((o) => o.activo).sort((a, b) => a.orden - b.orden)
  }, [selectedModelo])

  const colorOpciones = useMemo(() => {
    const colorAttr = selectedModelo?.atributos?.find(
      (a) => a.code.trim().toLowerCase() === 'color',
    )
    return (colorAttr?.opciones ?? []).filter((o) => o.activo).sort((a, b) => a.orden - b.orden)
  }, [selectedModelo])

  function resetForm() {
    setForm(EMPTY_FORM)
    fotoPreviews.forEach((u) => URL.revokeObjectURL(u))
    setFotoFiles([])
    setFotoPreviews([])
    setExistingFotos([])
    setDeleteAllFotosPending(false)
    setEditingIds(null)
    setActionError(null)
  }

  function pickFotos(files: File[]) {
    fotoPreviews.forEach((u) => URL.revokeObjectURL(u))
    setFotoFiles(files)
    setFotoPreviews(files.map((f) => URL.createObjectURL(f)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setActionError(null)

    const idModelo = Number(form.id_modelo)

    if (!isEditing) {
      if (!Number.isFinite(idModelo) || idModelo < 1) {
        setActionError('Elegí un modelo válido.')
        return
      }
    }

    if (!form.bateria_porcentaje) {
      setActionError('Elegí una opción de batería.')
      return
    }

    const precioArsRaw = String(form.precio_ars ?? '').trim()
    const precioArs = precioArsRaw === '' ? null : parseNumberEsAr(precioArsRaw)
    if (precioArsRaw !== '' && (!Number.isFinite(precioArs) || (precioArs ?? 0) < 0)) {
      setActionError('Ingresá un precio ARS válido.')
      return
    }

    const precioUsd =
      precioArs !== null && Number.isFinite(precioArs) && dolarRate && dolarRate > 0
        ? precioArs / dolarRate
        : null

    const capacidadGb = parseGbToInt(form.capacidad_gb)
    if (!isEditing && (capacidadGb == null || capacidadGb <= 0)) {
      setActionError('Seleccioná la capacidad del equipo.')
      return
    }

    setSaving(true)

    try {
      if (isEditing) {
        setBusyId(editingIds.idDetalle)
        await Promise.all([
          inventarioApi.equipos.patch(editingIds.idEquipo, {
            color: form.color.trim() || null,
            precio_ars: precioArs,
            precio_usd: precioUsd,
          }),
          inventarioApi.equiposUsadosDetalle.patch(editingIds.idDetalle, {
            bateria_porcentaje: form.bateria_porcentaje === '' ? null : Number(form.bateria_porcentaje),
            estado_estetico: form.estado_estetico || null,
            estado_funcional: form.estado_funcional || null,
            detalle_pantalla: form.detalle_pantalla || null,
            detalle_carcasa: form.detalle_carcasa || null,
            incluye_caja: form.incluye_caja,
            incluye_cargador: form.incluye_cargador,
          }),
        ])
        if (deleteAllFotosPending) await inventarioApi.equipos.deleteFotos(editingIds.idEquipo)
        if (fotoFiles.length > 0) await inventarioApi.equipos.uploadFotos(editingIds.idEquipo, fotoFiles)
      } else {
        const createdEquipo = await inventarioApi.equipos.createUsado({
          id_modelo: idModelo,
          capacidad_gb: capacidadGb,
          imei: form.imei.trim() || null,
          color: form.color.trim() || null,
          tipo_equipo: deriveTipoEquipo(selectedModelo?.nombre_modelo || form.nombre_modelo),
          precio_ars: precioArs,
          precio_usd: precioUsd,
          activo: true,
        })
        const idEquipo = createdEquipo.id_equipo ?? createdEquipo.id
        if (!idEquipo) throw new Error('No se pudo obtener el ID del equipo usado creado.')

        if (fotoFiles.length > 0) {
          await inventarioApi.equipos.uploadFotos(idEquipo, fotoFiles)
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
      }

      resetForm()
      await queryClient.invalidateQueries({ queryKey: qk.inventario.equipos })
      await queryClient.invalidateQueries({ queryKey: qk.inventario.equiposUsados })
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : isEditing
            ? 'Error al guardar cambios'
            : 'Error al crear equipo usado',
      )
    } finally {
      setSaving(false)
      setBusyId(null)
    }
  }

  function startEdit(r: EquipoUsadoDetalle) {
    const equipo = equiposById.get(r.id_equipo)
    if (!equipo) return
    fotoPreviews.forEach((u) => URL.revokeObjectURL(u))
    setFotoFiles([])
    setFotoPreviews([])
    setExistingFotos(equipo.fotos_urls?.length ? equipo.fotos_urls : equipo.foto_url ? [equipo.foto_url] : [])
    setDeleteAllFotosPending(false)
    setActionError(null)
    setEditingIds({ idEquipo: r.id_equipo, idDetalle: r.id_detalle_usado })
    setForm({
      nombre_modelo: equipo.modelo?.nombre_modelo ?? '',
      id_modelo: equipo.id_modelo ?? equipo.modelo?.id ?? '',
      capacidad_gb: equipo.modelo?.capacidad_gb != null ? String(equipo.modelo.capacidad_gb) : '',
      imei: equipo.imei ?? '',
      color: equipo.color ?? '',
      precio_ars: equipo.precio_ars != null ? String(equipo.precio_ars) : '',
      bateria_porcentaje: r.bateria_porcentaje != null ? String(r.bateria_porcentaje) : '',
      estado_estetico: r.estado_estetico ?? '',
      estado_funcional: r.estado_funcional ?? '',
      detalle_pantalla: r.detalle_pantalla ?? '',
      detalle_carcasa: r.detalle_carcasa ?? '',
      incluye_caja: r.incluye_caja,
      incluye_cargador: r.incluye_cargador,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleToggleActivo(r: EquipoUsadoDetalle) {
    const equipo = equiposById.get(r.id_equipo)
    if (!equipo) return
    setActionError(null)
    toggleActivo.mutate(
      { id: r.id_equipo, activo: !equipo.activo },
      { onError: (err) => setActionError(err instanceof Error ? err.message : 'Error al cambiar estado') },
    )
  }

  function handleDelete(r: EquipoUsadoDetalle) {
    if (!window.confirm(`¿Eliminar definitivamente el equipo #${r.id_equipo}? Esta acción no se puede deshacer.`)) return
    setActionError(null)
    if (editingIds?.idDetalle === r.id_detalle_usado) resetForm()
    eliminarEquipo.mutate(
      { idDetalle: r.id_detalle_usado, idEquipo: r.id_equipo },
      { onError: (err) => setActionError(err instanceof Error ? err.message : 'Error al eliminar') },
    )
  }

  return (
    <>
      <h1>Equipos usados</h1>
      <p className="lead">Alta rápida de equipos usados y su detalle en un único formulario.</p>

      {error ? <div className="msg-error">{error}</div> : null}

      <div className="panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>
            {isEditing ? `Editar equipo #${editingIds.idEquipo}` : 'Nuevo equipo usado'}
          </h2>
          {isEditing && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetForm}>
              Cancelar
            </button>
          )}
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>

            {/* ── Identidad del equipo (deshabilitado en edit) ── */}
            <label>
              Modelo
              <select
                value={form.nombre_modelo}
                onChange={(e) => {
                  const nombre = e.target.value
                  const nextModelo = modelos.find((m) => m.nombre_modelo === nombre) ?? null
                  setForm((f) => ({
                    ...f,
                    nombre_modelo: nombre,
                    id_modelo: nextModelo?.id ?? '',
                    capacidad_gb: '',
                    color: '',
                  }))
                }}
                disabled={isEditing}
                required={!isEditing}
              >
                <option value="">Seleccionar…</option>
                {nombresModelo.map((nombre) => (
                  <option key={nombre} value={nombre}>{nombre}</option>
                ))}
              </select>
            </label>

            <label>
              Capacidad (GB)
              {gbOpciones.length > 0 ? (
                <select
                  value={form.capacidad_gb}
                  onChange={(e) => setForm((f) => ({ ...f, capacidad_gb: e.target.value }))}
                  disabled={isEditing || !form.id_modelo}
                  required={!isEditing}
                >
                  {!form.id_modelo && !isEditing
                    ? <option value="">Primero elegí modelo…</option>
                    : <option value="">Seleccionar…</option>
                  }
                  {gbOpciones.map((op) => (
                    <option key={op.id} value={String(parseGbToInt(op.valor) ?? '')}>
                      {op.label || op.valor}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    list="gb-comunes"
                    value={form.capacidad_gb}
                    onChange={(e) => setForm((f) => ({ ...f, capacidad_gb: e.target.value }))}
                    disabled={isEditing || (!form.id_modelo && !isEditing)}
                    required={!isEditing}
                    placeholder={!form.id_modelo && !isEditing ? 'Primero elegí modelo…' : 'Ej: 128'}
                  />
                  <datalist id="gb-comunes">
                    {GB_COMUNES.map((gb) => (
                      <option key={gb} value={gb}>{gb === 1024 ? '1 TB' : `${gb} GB`}</option>
                    ))}
                  </datalist>
                </>
              )}
            </label>

            <label>
              IMEI
              <input
                value={form.imei}
                onChange={(e) => setForm((f) => ({ ...f, imei: e.target.value }))}
                disabled={isEditing}
                placeholder={isEditing ? undefined : 'Opcional'}
              />
            </label>

            {/* ── Fotos (ocupa toda la fila) ── */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 500, marginBottom: 0, color: 'var(--app-muted)' }}>
                Fotos del equipo (máx. 4)
              </p>

              {/* Fotos existentes */}
              {isEditing && !deleteAllFotosPending && existingFotos.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {existingFotos.map((url) => (
                    <img key={url} src={url} alt="Foto actual" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--app-border)' }} />
                  ))}
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => { setDeleteAllFotosPending(true); setExistingFotos([]) }}
                  >
                    Eliminar todas
                  </button>
                </div>
              )}

              {/* Previews de nuevas fotos seleccionadas */}
              {fotoPreviews.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {fotoPreviews.map((url, i) => (
                    <img key={i} src={url} alt={`Nueva ${i + 1}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--app-accent,#111)' }} />
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ width: 'auto' }}
                  onChange={(e) => {
                    const max = 4 - (deleteAllFotosPending ? 0 : existingFotos.length)
                    pickFotos(Array.from(e.target.files ?? []).slice(0, max))
                  }}
                />
                {isEditing && existingFotos.length > 0 && !deleteAllFotosPending && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--app-muted)' }}>
                    Podés agregar hasta {4 - existingFotos.length} foto{4 - existingFotos.length !== 1 ? 's' : ''} más
                  </span>
                )}
              </div>
            </div>

            {/* ── Atributos ── */}
            <label>
              Color
              {colorOpciones.length > 0 ? (
                <select
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  disabled={!form.id_modelo && !isEditing}
                >
                  <option value="">Seleccionar…</option>
                  {colorOpciones.map((op) => (
                    <option key={op.id} value={op.label || op.valor}>
                      {op.label || op.valor}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="Ej: Negro"
                />
              )}
            </label>

            <label>
              Batería (%)
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={form.bateria_porcentaje}
                onChange={(e) => setForm((f) => ({ ...f, bateria_porcentaje: e.target.value }))}
                placeholder="Ej: 87"
                required
              />
            </label>

            {/* ── Precios ── */}
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

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '0.45rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--app-muted)' }}>
                Cotización:{' '}
                <strong style={{ fontWeight: 600 }}>
                  {loadingDolar ? 'cargando…' : dolarRate ? fmtArs(dolarRate) : 'no disponible'}
                </strong>
                {dolarUpdatedAt
                  ? <><br />{new Date(dolarUpdatedAt).toLocaleString('es-AR')}</>
                  : null}
              </span>
            </div>

            {/* ── Condición ── */}
            <label>
              Estado estético
              <select
                value={form.estado_estetico}
                onChange={(e) => setForm((f) => ({ ...f, estado_estetico: e.target.value }))}
                required
              >
                <option value="">Seleccionar…</option>
                {ESTADO_ESTATICA_OPTIONS.map((v) => (
                  <option key={v} value={v}>{v}</option>
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
                  <option key={v} value={v}>{v}</option>
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
                  <option key={v} value={v}>{v}</option>
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
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>

            {/* ── Accesorios incluidos (fila completa) ── */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '2rem', flexWrap: 'wrap', paddingBottom: '0.1rem' }}>
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

          </div>

          <div className="toolbar" style={{ marginTop: '0.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving
                ? isEditing ? 'Guardando…' : 'Creando…'
                : isEditing ? 'Guardar cambios' : 'Crear equipo usado'}
            </button>
            {isEditing && (
              <button type="button" className="btn btn-ghost" onClick={resetForm} disabled={saving}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Listado ── */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Listado de usados</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>
            {rows.length > 0 ? `${rows.length} equipo${rows.length !== 1 ? 's' : ''}` : ''}
          </span>
        </div>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Equipo</th>
                <th>Tipo</th>
                <th>Batería</th>
                <th>Condición</th>
                <th>Precio ARS</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right', paddingRight: '1rem' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="skeleton-row">
                    <td><span className="skeleton" style={{ width: 40, height: 40, borderRadius: 8, display: 'block' }} /></td>
                    <td><span className="skeleton" style={{ width: 140, height: 14 }} /></td>
                    <td><span className="skeleton" style={{ width: 60, height: 18, borderRadius: 999 }} /></td>
                    <td><span className="skeleton" style={{ width: 44, height: 14 }} /></td>
                    <td><span className="skeleton" style={{ width: 90, height: 14 }} /></td>
                    <td><span className="skeleton" style={{ width: 80, height: 14 }} /></td>
                    <td><span className="skeleton" style={{ width: 55, height: 18, borderRadius: 999 }} /></td>
                    <td />
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--app-muted)', padding: '2rem 1rem' }}>
                    No hay equipos usados cargados. Creá el primero con el formulario de arriba.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const equipo = equiposById.get(r.id_equipo)
                  const isBeingEdited = editingIds?.idDetalle === r.id_detalle_usado
                  return (
                    <tr
                      key={r.id_detalle_usado}
                      className={busyId === r.id_detalle_usado ? 'row-busy' : ''}
                      style={isBeingEdited ? { background: 'var(--app-muted-bg)' } : undefined}
                    >
                      {/* Foto */}
                      <td>
                        {equipo?.foto_url ? (
                          <img
                            src={mediaUrl(equipo.foto_url)}
                            alt=""
                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--app-border)', display: 'block' }}
                          />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--app-muted-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--app-muted)" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                            </svg>
                          </div>
                        )}
                      </td>

                      {/* Equipo */}
                      <td style={{ fontWeight: 500, color: 'var(--app-text-strong)' }}>
                        {equipo?.modelo?.nombre_modelo ?? '—'}
                        {(equipo?.modelo?.capacidad_gb || equipo?.color) ? (
                          <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--app-muted)', fontWeight: 400 }}>
                            {[equipo?.modelo?.capacidad_gb ? `${equipo.modelo.capacidad_gb} GB` : null, equipo?.color].filter(Boolean).join(' · ')}
                          </span>
                        ) : null}
                      </td>

                      {/* Tipo */}
                      <td>
                        <span className="badge badge-info" style={{ textTransform: 'capitalize', fontSize: '0.72rem' }}>
                          {equipo?.tipo_equipo ?? '—'}
                        </span>
                      </td>

                      {/* Batería */}
                      <td style={{ fontSize: '0.85rem' }}>
                        {r.bateria_porcentaje != null ? `${r.bateria_porcentaje}%` : '—'}
                      </td>

                      {/* Condición */}
                      <td style={{ fontSize: '0.82rem', color: 'var(--app-muted)' }}>
                        {r.estado_estetico ?? '—'}
                        {r.estado_funcional && r.estado_funcional !== r.estado_estetico ? (
                          <span style={{ display: 'block', fontSize: '0.75rem' }}>{r.estado_funcional}</span>
                        ) : null}
                      </td>

                      {/* Precio */}
                      <td style={{ fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {equipo?.precio_ars != null ? fmtArs(equipo.precio_ars) : '—'}
                      </td>

                      {/* Estado */}
                      <td>
                        <span className={`badge ${equipo?.activo ? 'badge-on' : 'badge-off'}`}>
                          {equipo?.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="td-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === r.id_detalle_usado}
                          onClick={() => startEdit(r)}
                        >
                          {isBeingEdited ? 'Editando…' : 'Editar'}
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
