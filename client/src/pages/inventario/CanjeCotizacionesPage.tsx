import { useCallback, useEffect, useMemo, useState } from 'react'
import { canjeApi } from '../../services/canjeApi'
import type { CotizacionCanje, ModeloCanje } from '../../types/canje'
import { compareIphoneModelNames, sortIphoneModelNames } from '../../lib/iphoneModelSort'
import {
  BATTERY_INTERVAL_PRESETS,
  getBatteryIntervalByKey,
  getBatteryIntervalLabel,
  getBatteryIntervalPresetKey,
  type BatteryIntervalPresetKey,
} from '../../lib/canjeBatteryIntervals'

type CanjeFormState = {
  nombre_modelo: string
  capacidad_gb: string
  intervalo_preset: BatteryIntervalPresetKey
  valor_toma_usd: string
}

type EditCotizacionFormState = {
  intervalo_preset: BatteryIntervalPresetKey | 'custom'
  bateria_min: string
  bateria_max: string
  valor_toma_usd: string
  activo: boolean
}

const MODEL_OPTIONS_STORAGE_KEY = 'fixit_canje_model_options_v1'
const MODEL_ORDER_MODE_STORAGE_KEY = 'fixit_canje_model_order_mode_v1'

const defaultModelOptions = [
  'iPhone 13',
  'iPhone 13 Pro',
  'iPhone 13 Pro Max',
  'iPhone 14',
  'iPhone 14 Pro',
  'iPhone 15',
  'iPhone 16',
  'iPhone 16 Pro',
  'iPhone 16 Pro Max',
]

const emptyForm: CanjeFormState = {
  nombre_modelo: '',
  capacidad_gb: '',
  intervalo_preset: 'lt80',
  valor_toma_usd: '',
}

const emptyEditForm: EditCotizacionFormState = {
  intervalo_preset: 'lt80',
  bateria_min: '',
  bateria_max: '',
  valor_toma_usd: '',
  activo: true,
}

export function CanjeCotizacionesPage() {
  const [rows, setRows] = useState<CotizacionCanje[]>([])
  const [modelos, setModelos] = useState<ModeloCanje[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDolar, setLoadingDolar] = useState(true)
  const [dolarRate, setDolarRate] = useState<number | null>(null)
  const [dolarUpdatedAt, setDolarUpdatedAt] = useState<string | null>(null)
  const [tableCurrency, setTableCurrency] = useState<'ars' | 'usd'>('ars')
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<CanjeFormState>(emptyForm)
  const [newModelOption, setNewModelOption] = useState('')
  const [modelOptions, setModelOptions] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(MODEL_OPTIONS_STORAGE_KEY)
      if (!raw) return sortIphoneModelNames(defaultModelOptions)
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return sortIphoneModelNames(defaultModelOptions)
      const cleaned = parsed
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter((x) => x.length > 0)
      return cleaned.length > 0 ? sortIphoneModelNames(cleaned) : sortIphoneModelNames(defaultModelOptions)
    } catch {
      return sortIphoneModelNames(defaultModelOptions)
    }
  })
  const [modelOrderMode, setModelOrderMode] = useState<'auto' | 'manual'>(() => {
    try {
      const raw = localStorage.getItem(MODEL_ORDER_MODE_STORAGE_KEY)
      return raw === 'manual' ? 'manual' : 'auto'
    } catch {
      return 'auto'
    }
  })
  const [editingCotizacionId, setEditingCotizacionId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditCotizacionFormState>(emptyEditForm)

  useEffect(() => {
    localStorage.setItem(MODEL_OPTIONS_STORAGE_KEY, JSON.stringify(modelOptions))
  }, [modelOptions])

  useEffect(() => {
    localStorage.setItem(MODEL_ORDER_MODE_STORAGE_KEY, modelOrderMode)
  }, [modelOrderMode])

  const canEditWithUsd = !loadingDolar && !!dolarRate && dolarRate > 0
  const displayModelOptions = useMemo(
    () => (modelOrderMode === 'manual' ? modelOptions : sortIphoneModelNames(modelOptions)),
    [modelOptions, modelOrderMode],
  )

  const modelOrderIndex = useMemo(() => {
    const map = new Map<string, number>()
    displayModelOptions.forEach((name, index) => map.set(name.trim().toLowerCase(), index))
    return map
  }, [displayModelOptions])

  function fmtArs(value: number) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value)
  }

  function fmtUsd(value: number) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value)
  }

  function fmtDateTime(iso: string | null) {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('es-AR')
  }

  const valorUsdNum = Number(form.valor_toma_usd)
  const valorEstimadoArs =
    dolarRate && Number.isFinite(valorUsdNum) && valorUsdNum > 0 ? valorUsdNum * dolarRate : null

  const modeloLabelById = useMemo(() => {
    const map = new Map<number, string>()
    for (const m of modelos) {
      const extra = m.capacidad_gb ? ` ${m.capacidad_gb} GB` : ''
      map.set(m.id_modelo_canje, `${m.nombre_modelo}${extra}`)
    }
    return map
  }, [modelos])

  const groupedRows = useMemo(() => {
    const grouped = new Map<
      number,
      { modeloLabel: string; intervals: CotizacionCanje[]; hasActive: boolean }
    >()

    for (const row of rows) {
      const current = grouped.get(row.id_modelo_canje)
      const modeloLabel = modeloLabelById.get(row.id_modelo_canje) ?? `Modelo ${row.id_modelo_canje}`
      if (!current) {
        grouped.set(row.id_modelo_canje, {
          modeloLabel,
          intervals: [row],
          hasActive: row.activo,
        })
      } else {
        current.intervals.push(row)
        current.hasActive = current.hasActive || row.activo
      }
    }

    return [...grouped.entries()]
      .map(([idModelo, value]) => ({
        idModelo,
        ...value,
        intervals: value.intervals.sort((a, b) => a.bateria_min - b.bateria_min),
      }))
      .sort((a, b) => {
        if (modelOrderMode === 'manual') {
          const aBase = a.modeloLabel.replace(/\s+\d+\s*gb$/i, '').trim().toLowerCase()
          const bBase = b.modeloLabel.replace(/\s+\d+\s*gb$/i, '').trim().toLowerCase()
          const ai = modelOrderIndex.get(aBase)
          const bi = modelOrderIndex.get(bBase)
          if (ai != null && bi != null && ai !== bi) return ai - bi
          if (ai != null && bi == null) return -1
          if (ai == null && bi != null) return 1
        }
        return compareIphoneModelNames(a.modeloLabel, b.modeloLabel)
      })
  }, [rows, modeloLabelById, modelOrderMode, modelOrderIndex])

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [modelosData, cotizacionesData] = await Promise.all([
        canjeApi.modelos.list(0, 100),
        canjeApi.cotizaciones.list(),
      ])
      setModelos(modelosData)
      setRows(cotizacionesData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar cotizaciones de canje')
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
        // Fallback estable para no romper la pantalla si falla el servicio externo.
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

  function resetForm() {
    setForm(emptyForm)
  }

  function addModelOption() {
    const name = newModelOption.trim()
    if (!name) return
    const exists = modelOptions.some((m) => m.toLowerCase() === name.toLowerCase())
    if (exists) {
      setNewModelOption('')
      return
    }
    setModelOptions((prev) => sortIphoneModelNames([...prev, name]))
    setForm((prev) => ({ ...prev, nombre_modelo: name }))
    setNewModelOption('')
  }

  function removeModelOption(name: string) {
    setModelOptions((prev) => prev.filter((m) => m !== name))
    setForm((prev) => (prev.nombre_modelo === name ? { ...prev, nombre_modelo: '' } : prev))
  }

  function moveModelOption(name: string, direction: -1 | 1) {
    setModelOptions((prev) => {
      const idx = prev.findIndex((m) => m === name)
      if (idx < 0) return prev
      const next = idx + direction
      if (next < 0 || next >= prev.length) return prev
      const clone = [...prev]
      const [item] = clone.splice(idx, 1)
      clone.splice(next, 0, item)
      return clone
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const nombreModelo = form.nombre_modelo.trim()
    const capacidadGb = Number(form.capacidad_gb)
    const preset = getBatteryIntervalByKey(form.intervalo_preset)
    const bateria_min = preset.min
    const bateria_max = preset.max
    const valor_toma_usd = Number(form.valor_toma_usd)

    if (!nombreModelo) {
      setError('El nombre del modelo es obligatorio.')
      return
    }
    if (!Number.isInteger(capacidadGb) || capacidadGb <= 0) {
      setError('La cantidad de GB debe ser un entero positivo.')
      return
    }
    if (!Number.isInteger(bateria_min) || !Number.isInteger(bateria_max)) {
      setError('Los rangos de batería deben ser números enteros.')
      return
    }
    if (bateria_min < 0 || bateria_max > 100 || bateria_min > bateria_max) {
      setError('El rango de batería debe estar entre 0 y 100, y bateria_min <= bateria_max.')
      return
    }
    if (!Number.isFinite(valor_toma_usd) || valor_toma_usd <= 0) {
      setError('Ingresa un valor en USD mayor a 0.')
      return
    }
    if (!dolarRate || dolarRate <= 0) {
      setError('No se pudo obtener la cotizacion del dolar para convertir a ARS.')
      return
    }

    const valor_toma = valor_toma_usd * dolarRate

    try {
      const modelo = await canjeApi.modelos.create({
        nombre_modelo: nombreModelo,
        capacidad_gb: capacidadGb,
        activo: true,
      })

      await canjeApi.cotizaciones.create({
        id_modelo_canje: modelo.id_modelo_canje,
        bateria_min,
        bateria_max,
        valor_toma,
        activo: true,
      })

      resetForm()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar cotización')
    }
  }

  function startEdit(interval: CotizacionCanje) {
    if (!canEditWithUsd) return
    const usd = dolarRate && Number(interval.valor_toma) > 0
      ? Number(interval.valor_toma) / dolarRate
      : null
    setEditingCotizacionId(interval.id_cotizacion)
    setEditForm({
      intervalo_preset: getBatteryIntervalPresetKey(interval.bateria_min, interval.bateria_max),
      bateria_min: String(interval.bateria_min),
      bateria_max: String(interval.bateria_max),
      valor_toma_usd: usd != null ? usd.toFixed(2) : '',
      activo: interval.activo,
    })
  }

  function cancelEdit() {
    setEditingCotizacionId(null)
    setEditForm(emptyEditForm)
  }

  async function handleSaveEdit(idCotizacion: number) {
    setError(null)

    const preset =
      editForm.intervalo_preset === 'custom' ? null : getBatteryIntervalByKey(editForm.intervalo_preset)
    const bateria_min = preset ? preset.min : Number(editForm.bateria_min)
    const bateria_max = preset ? preset.max : Number(editForm.bateria_max)
    const valor_toma_usd = Number(editForm.valor_toma_usd)

    if (!Number.isInteger(bateria_min) || !Number.isInteger(bateria_max)) {
      setError('Los rangos de bateria deben ser numeros enteros.')
      return
    }
    if (bateria_min < 0 || bateria_max > 100 || bateria_min > bateria_max) {
      setError('El rango de bateria debe estar entre 0 y 100, y bateria_min <= bateria_max.')
      return
    }
    if (!Number.isFinite(valor_toma_usd) || valor_toma_usd <= 0) {
      setError('Ingresa un valor en USD mayor a 0 para la cotizacion.')
      return
    }
    if (!dolarRate || dolarRate <= 0) {
      setError('No se pudo obtener la cotizacion del dolar para convertir a ARS.')
      return
    }

    const valor_toma = valor_toma_usd * dolarRate

    try {
      await canjeApi.cotizaciones.patch(idCotizacion, {
        bateria_min,
        bateria_max,
        valor_toma,
        activo: editForm.activo,
      })
      cancelEdit()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al editar cotizacion')
    }
  }

  return (
    <>
      <h1>Cotizaciones</h1>
      <p className="lead">
        En esta pantalla se crea todo junto: modelo, capacidad, intervalo de bateria y precio de cotizacion.
      </p>

      <p className="msg-muted" style={{ marginTop: '-0.25rem' }}>
        Dolar referencia: {loadingDolar ? 'cargando...' : dolarRate ? fmtArs(dolarRate) : 'no disponible'} por USD.
      </p>
      <p className="msg-muted" style={{ marginTop: '-0.25rem' }}>
        Ultima actualizacion: {loadingDolar ? 'cargando...' : fmtDateTime(dolarUpdatedAt)}
      </p>

      {error ? <div className="msg-error">{error}</div> : null}

      <div className="panel">
        <h2>Nuevo Cotizacion</h2>
        <div className="toolbar" style={{ marginTop: '-0.2rem', marginBottom: '0.6rem' }}>
          <span className="msg-muted">Orden modelos:</span>
          <button
            type="button"
            className={`btn btn-sm ${modelOrderMode === 'auto' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setModelOrderMode('auto')}
          >
            Automatico
          </button>
          <button
            type="button"
            className={`btn btn-sm ${modelOrderMode === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setModelOrderMode('manual')}
          >
            Manual
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Nombre del modelo
              <select
                value={form.nombre_modelo}
                onChange={(e) => setForm((prev) => ({ ...prev, nombre_modelo: e.target.value }))}
                required
              >
                <option value="">Seleccionar...</option>
                {displayModelOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Cantidad de GB
              <select
                value={form.capacidad_gb}
                onChange={(e) => setForm((prev) => ({ ...prev, capacidad_gb: e.target.value }))}
                required
              >
                <option value="">Seleccionar...</option>
                <option value="64">64 GB</option>
                <option value="128">128 GB</option>
                <option value="256">256 GB</option>
                <option value="512">512 GB</option>
              </select>
            </label>

            <label>
              Intervalo de bateria
              <select
                value={form.intervalo_preset}
                onChange={(e) =>
                  setForm((prev) => {
                    const nextPreset = e.target.value as BatteryIntervalPresetKey
                    return { ...prev, intervalo_preset: nextPreset }
                  })
                }
              >
                {BATTERY_INTERVAL_PRESETS.map((presetItem) => (
                  <option key={presetItem.key} value={presetItem.key}>
                    {presetItem.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Valor de toma (USD)
              <input
                type="number"
                min={1}
                step="0.01"
                value={form.valor_toma_usd}
                onChange={(e) => setForm((prev) => ({ ...prev, valor_toma_usd: e.target.value }))}
                required
              />
            </label>
          </div>

          <div
            style={{
              marginTop: '0.8rem',
              padding: '0.8rem',
              border: '1px solid var(--border, #e6e6e6)',
              borderRadius: '10px',
              background: 'var(--panelBg, #fafafa)',
            }}
          >
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', marginBottom: '0.35rem' }}>Agregar modelo</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
                <input
                  value={newModelOption}
                  onChange={(e) => setNewModelOption(e.target.value)}
                  placeholder="Ej: iPhone 17 Pro"
                />
                <button type="button" className="btn btn-ghost" onClick={addModelOption}>
                  Agregar
                </button>
              </div>
            </label>

            <div style={{ marginTop: '0.55rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {displayModelOptions.map((option) => (
                <span
                  key={option}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '999px',
                    border: '1px solid var(--border, #e6e6e6)',
                    fontSize: '0.8rem',
                    background: '#fff',
                  }}
                >
                  {option}
                  {modelOrderMode === 'manual' ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0 0.25rem' }}
                        onClick={() => moveModelOption(option, -1)}
                        aria-label={`Subir ${option}`}
                        title={`Subir ${option}`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0 0.25rem' }}
                        onClick={() => moveModelOption(option, 1)}
                        aria-label={`Bajar ${option}`}
                        title={`Bajar ${option}`}
                      >
                        ↓
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '0 0.25rem' }}
                    onClick={() => removeModelOption(option)}
                    aria-label={`Eliminar ${option}`}
                    title={`Eliminar ${option}`}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          </div>

          <p className="msg-muted" style={{ marginTop: '0.75rem' }}>
            Intervalo seleccionado:{' '}
            {getBatteryIntervalByKey(form.intervalo_preset).label}
          </p>

          <p className="msg-muted" style={{ marginTop: '0.25rem' }}>
            Valor estimado en ARS: {valorEstimadoArs != null ? fmtArs(valorEstimadoArs) : '—'}
          </p>

          <div className="toolbar" style={{ marginTop: '0.75rem' }}>
            <button type="submit" className="btn btn-primary">
              Guardar canje
            </button>
            <button type="button" className="btn btn-ghost" onClick={resetForm}>
              Limpiar
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>Cotizaciones cargadas</h2>
        <p className="msg-muted">Vista agrupada por modelo para evitar repeticion de filas.</p>
        <div className="toolbar" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
          <span className="msg-muted">Moneda tabla:</span>
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
          <p className="msg-muted">Cargando...</p>
        ) : groupedRows.length === 0 ? (
          <p className="msg-muted">No hay canjes cargados.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Intervalos de bateria y cotizacion</th>
                  <th>Activo</th>
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((group) => (
                  <tr key={group.idModelo}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>{group.modeloLabel}</span>
                        {group.intervals.some((i) => i.id_cotizacion === editingCotizacionId) ? (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              borderRadius: '999px',
                              padding: '0.1rem 0.45rem',
                              background: '#fff7ed',
                              color: '#9a3412',
                              border: '1px solid #fed7aa',
                              fontWeight: 600,
                            }}
                          >
                            Editando...
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'grid', gap: '0.25rem' }}>
                        {group.intervals.map((interval) => {
                          const valorArs = Number(interval.valor_toma)
                          const valorUsd = dolarRate && valorArs > 0 ? valorArs / dolarRate : null
                          const isEditing = editingCotizacionId === interval.id_cotizacion
                          return (
                            <div key={interval.id_cotizacion}>
                              {isEditing ? (
                                <div style={{ display: 'grid', gap: '0.35rem', marginBottom: '0.5rem' }}>
                                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                    <select
                                      value={editForm.intervalo_preset}
                                      onChange={(e) =>
                                        setEditForm((prev) => {
                                          const nextPreset = e.target.value as BatteryIntervalPresetKey | 'custom'
                                          if (nextPreset === 'custom') {
                                            return { ...prev, intervalo_preset: 'custom' }
                                          }
                                          const range = getBatteryIntervalByKey(nextPreset)
                                          return {
                                            ...prev,
                                            intervalo_preset: nextPreset,
                                            bateria_min: String(range.min),
                                            bateria_max: String(range.max),
                                          }
                                        })
                                      }
                                      style={{ width: '220px' }}
                                    >
                                      {BATTERY_INTERVAL_PRESETS.map((presetItem) => (
                                        <option key={presetItem.key} value={presetItem.key}>
                                          {presetItem.label}
                                        </option>
                                      ))}
                                      {editForm.intervalo_preset === 'custom' ? (
                                        <option value="custom">Personalizado ({editForm.bateria_min}-{editForm.bateria_max})</option>
                                      ) : null}
                                    </select>
                                  </div>
                                  <p className="msg-muted" style={{ margin: 0 }}>
                                    Intervalo aplicado: {getBatteryIntervalLabel(Number(editForm.bateria_min), Number(editForm.bateria_max))}
                                  </p>
                                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                    <span>USD</span>
                                    <input
                                      type="number"
                                      min={1}
                                      step="0.01"
                                      value={editForm.valor_toma_usd}
                                      onChange={(e) => setEditForm((prev) => ({ ...prev, valor_toma_usd: e.target.value }))}
                                      style={{ width: '120px' }}
                                    />
                                    <label style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                      <input
                                        type="checkbox"
                                        checked={editForm.activo}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, activo: e.target.checked }))}
                                      />
                                      Activo
                                    </label>
                                  </div>
                                  <div className="toolbar" style={{ marginTop: 0 }}>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-primary"
                                      onClick={() => void handleSaveEdit(interval.id_cotizacion)}
                                    >
                                      Guardar
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-ghost"
                                      onClick={cancelEdit}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span>
                                    <strong>{getBatteryIntervalLabel(interval.bateria_min, interval.bateria_max)}</strong>{' '}
                                    :{' '}
                                    {tableCurrency === 'ars'
                                      ? fmtArs(valorArs)
                                      : valorUsd != null
                                        ? fmtUsd(valorUsd)
                                        : '—'}
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-ghost"
                                    onClick={() => startEdit(interval)}
                                    disabled={!canEditWithUsd}
                                    title={canEditWithUsd ? 'Editar cotizacion' : 'No se puede editar sin dolar cargado'}
                                  >
                                    Editar
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </td>
                    <td>{group.hasActive ? 'Sí' : 'No'}</td>
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
