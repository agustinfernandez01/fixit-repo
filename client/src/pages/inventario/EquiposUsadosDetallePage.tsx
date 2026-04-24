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
  const [dolarRate, setDolarRate] = useState<number | null>(null)
  const [loadingDolar, setLoadingDolar] = useState(true)
  const [dolarUpdatedAt, setDolarUpdatedAt] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    id_modelo: '' as string | number,
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

    setSaving(true)
    try {
      const createdEquipo = await inventarioApi.equipos.createUsado({
        id_modelo: idModelo,
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
                onChange={(e) => setForm((f) => ({ ...f, id_modelo: e.target.value }))}
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
              <input value={form.imei} onChange={(e) => setForm((f) => ({ ...f, imei: e.target.value }))} />
            </label>

            <label>
              Foto del equipo
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFotoFile(e.target.files?.[0] ?? null)}
              />
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
