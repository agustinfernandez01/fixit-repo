import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAccessToken, getCurrentUserId } from '../../lib/auth'
import {
  BATTERY_INTERVAL_PRESETS,
  getBatteryIntervalLabel,
  getBatteryIntervalPresetKey,
  intervalValue,
  parseBatteryIntervalValue,
} from '../../lib/canjeBatteryIntervals'
import { compareIphoneModelNames } from '../../lib/iphoneModelSort'
import { getProductCondition, isRepairProduct } from '../../lib/catalogProductRules'
import { canjeApi } from '../../services/canjeApi'
import { productosApi } from '../../services/productosApi'
import type { CotizacionCanje, CotizarCanjeResponse, ModeloCanje } from '../../types/canje'
import type { ProductoCompra } from '../../types/carrito'

type ProductConditionFilter = 'todos' | 'nuevo' | 'usado'

type CanjeForm = {
  id_modelo_canje: string
  bateria_intervalo: string
  estado_estetico: string
  estado_funcional: string
  observaciones: string
}

const emptyForm: CanjeForm = {
  id_modelo_canje: '',
  bateria_intervalo: '',
  estado_estetico: '',
  estado_funcional: '',
  observaciones: '',
}

const estadoOptions = ['desgastado', 'bueno', 'excelente'] as const

function money(value: number | string | null | undefined) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `$${n.toLocaleString('es-AR')}`
}

function conditionLabel(condition: 'nuevo' | 'usado') {
  return condition === 'usado' ? 'Usado' : 'Nuevo'
}

function modelLabel(modelo: ModeloCanje) {
  const extra = modelo.capacidad_gb != null ? ` ${modelo.capacidad_gb} GB` : ''
  return `${modelo.nombre_modelo}${extra}`
}

function mapCanjeError(raw: string): string {
  if (raw.includes('No se encontró un modelo de canje compatible con el equipo ofrecido.')) {
    return 'No pudimos identificar ese modelo para cotizar. Elegi un modelo del listado y un rango de bateria disponible.'
  }
  if (raw.includes('No existe cotización de canje para ese modelo y rango de batería.')) {
    return 'No hay cotizacion configurada para el rango de bateria elegido. Selecciona otro rango.'
  }
  return raw
}

export default function CanjePage() {
  const [form, setForm] = useState<CanjeForm>(emptyForm)
  const [equipoFotos, setEquipoFotos] = useState<File[]>([])
  const [fotoError, setFotoError] = useState<string | null>(null)
  const [productos, setProductos] = useState<ProductoCompra[]>([])
  const [modelos, setModelos] = useState<ModeloCanje[]>([])
  const [cotizaciones, setCotizaciones] = useState<CotizacionCanje[]>([])
  const [loadingProductos, setLoadingProductos] = useState(true)
  const [loadingConfigCanje, setLoadingConfigCanje] = useState(true)
  const [conditionFilter, setConditionFilter] = useState<ProductConditionFilter>('todos')
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [presupuesto, setPresupuesto] = useState<CotizarCanjeResponse | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [creatingSolicitud, setCreatingSolicitud] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const logged = !!getAccessToken()
  const currentUserId = getCurrentUserId()

  const productosCanjeables = useMemo(
    () =>
      productos.filter(
        (p) => p.activo && (p.tipo_producto === 'equipo' || p.tipo_producto == null) && !isRepairProduct(p),
      ),
    [productos],
  )

  const modelosActivos = useMemo(
    () =>
      modelos
        .filter((m) => m.activo)
        .sort((a, b) => compareIphoneModelNames(modelLabel(a), modelLabel(b))),
    [modelos],
  )

  const productosFiltrados = useMemo(() => {
    if (conditionFilter === 'todos') return productosCanjeables
    return productosCanjeables.filter((p) => getProductCondition(p) === conditionFilter)
  }, [conditionFilter, productosCanjeables])

  const selectedProduct = useMemo(
    () => productosCanjeables.find((p) => p.id === selectedProductId) ?? null,
    [productosCanjeables, selectedProductId],
  )

  const equipoFotoPreviews = useMemo(
    () => equipoFotos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [equipoFotos],
  )

  useEffect(() => {
    return () => {
      equipoFotoPreviews.forEach((item) => URL.revokeObjectURL(item.url))
    }
  }, [equipoFotoPreviews])

  const intervalosBateria = useMemo(() => {
    const idModelo = Number(form.id_modelo_canje)
    if (!Number.isInteger(idModelo) || idModelo <= 0) return []
    const raw = cotizaciones
      .filter((c) => c.activo && c.id_modelo_canje === idModelo)
      .sort((a, b) => a.bateria_min - b.bateria_min)

    const dedup = new Map<string, CotizacionCanje>()
    for (const item of raw) {
      const key = intervalValue(item.bateria_min, item.bateria_max)
      if (!dedup.has(key)) dedup.set(key, item)
    }

    const presetOrder = new Map<string, number>()
    BATTERY_INTERVAL_PRESETS.forEach((preset, idx) => {
      presetOrder.set(preset.key, idx)
    })

    return [...dedup.values()].sort((a, b) => {
      const pa = getBatteryIntervalPresetKey(a.bateria_min, a.bateria_max)
      const pb = getBatteryIntervalPresetKey(b.bateria_min, b.bateria_max)
      const ia = pa === 'custom' ? Number.MAX_SAFE_INTEGER : (presetOrder.get(pa) ?? Number.MAX_SAFE_INTEGER)
      const ib = pb === 'custom' ? Number.MAX_SAFE_INTEGER : (presetOrder.get(pb) ?? Number.MAX_SAFE_INTEGER)
      if (ia !== ib) return ia - ib
      return a.bateria_min - b.bateria_min
    })
  }, [cotizaciones, form.id_modelo_canje])

  useEffect(() => {
    let alive = true
    async function load() {
      setError(null)
      setLoadingProductos(true)
      setLoadingConfigCanje(true)
      try {
        const [productosData, modelosData, cotizacionesData] = await Promise.all([
          productosApi.list(),
          canjeApi.modelos.list(0, 100, true),
          canjeApi.cotizaciones.list(null, true),
        ])
        if (!alive) return
        setProductos(productosData)
        setModelos(modelosData)
        setCotizaciones(cotizacionesData)
      } catch (e) {
        if (!alive) return
        const raw = e instanceof Error ? e.message : 'No se pudo cargar el modulo de canje'
        setError(mapCanjeError(raw))
      } finally {
        if (!alive) return
        setLoadingProductos(false)
        setLoadingConfigCanje(false)
      }
    }

    void load()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    setForm((prev) => ({ ...prev, bateria_intervalo: '' }))
  }, [form.id_modelo_canje])

  async function handleCalcularPresupuesto(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setPresupuesto(null)

    if (!logged || currentUserId == null) {
      setError('Para calcular el canje necesitas iniciar sesion.')
      return
    }
    if (selectedProductId == null) {
      setError('Selecciona el producto que queres llevarte.')
      return
    }

    const idModelo = Number(form.id_modelo_canje)
    if (!Number.isInteger(idModelo) || idModelo <= 0) {
      setError('Selecciona un modelo de equipo del listado.')
      return
    }

    const selectedModelo = modelosActivos.find((m) => m.id_modelo_canje === idModelo)
    if (!selectedModelo) {
      setError('Selecciona un modelo valido para cotizar el canje.')
      return
    }

    const parsedInterval = parseBatteryIntervalValue(form.bateria_intervalo)
    if (!parsedInterval) {
      setError('Selecciona un intervalo de bateria valido.')
      return
    }

    if (!form.estado_estetico) {
      setError('Selecciona el estado estetico del equipo.')
      return
    }
    if (!form.estado_funcional) {
      setError('Selecciona el estado funcional del equipo.')
      return
    }

    // Usa el punto medio del intervalo para garantizar match con la cotizacion vigente.
    const bateria = Math.floor((parsedInterval.min + parsedInterval.max) / 2)

    setCalculating(true)
    try {
      const pres = await canjeApi.cotizador.cotizar({
        id_modelo_canje: idModelo,
        bateria_porcentaje: bateria,
        id_producto_interes: selectedProductId,
      })

      setPresupuesto(pres)

      if (pres.aprobado) {
        setSuccess(pres.mensaje_usuario)
      } else {
        setSuccess(pres.mensaje_usuario)
      }
    } catch (eCalc) {
      const raw = eCalc instanceof Error ? eCalc.message : 'No se pudo calcular el presupuesto de canje'
      setError(mapCanjeError(raw))
    } finally {
      setCalculating(false)
    }
  }

  async function handleCrearSolicitud() {
    setError(null)
    setSuccess(null)

    if (!presupuesto || !presupuesto.aprobado || selectedProductId == null) {
      setError('Primero calcula un presupuesto aprobado.')
      return
    }
    if (currentUserId == null) {
      setError('No se pudo identificar tu usuario. Volve a iniciar sesion.')
      return
    }

    setCreatingSolicitud(true)
    try {
      const idModelo = Number(form.id_modelo_canje)
      const selectedModelo = modelosActivos.find((m) => m.id_modelo_canje === idModelo)
      if (!selectedModelo) {
        setError('Selecciona un modelo valido antes de confirmar la solicitud.')
        return
      }

      const parsedInterval = parseBatteryIntervalValue(form.bateria_intervalo)
      if (!parsedInterval) {
        setError('Selecciona un intervalo de bateria valido antes de confirmar la solicitud.')
        return
      }

      const bateria = Math.floor((parsedInterval.min + parsedInterval.max) / 2)

      const equipo = await canjeApi.equiposOfrecidos.create({
        id_usuario: currentUserId,
        modelo: selectedModelo.nombre_modelo,
        capacidad_gb: selectedModelo.capacidad_gb,
        bateria_porcentaje: bateria,
        estado_estetico: form.estado_estetico,
        estado_funcional: form.estado_funcional,
        observaciones: form.observaciones.trim() || null,
        activo: true,
      })

      if (equipoFotos.length > 0) {
        await canjeApi.equiposOfrecidos.uploadFotos(equipo.id_equipo_ofrecido, equipoFotos)
      }

      await canjeApi.solicitudes.create({
        id_usuario: currentUserId,
        id_equipo_ofrecido: equipo.id_equipo_ofrecido,
        id_producto_interes: selectedProductId,
      })
      setSuccess('Solicitud de canje enviada. Te contactaremos para la validacion final del equipo.')
      setEquipoFotos([])
      setFotoError(null)
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'No se pudo crear la solicitud de canje'
      setError(mapCanjeError(raw))
    } finally {
      setCreatingSolicitud(false)
    }
  }

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="rounded-3xl border border-gray-100 bg-gradient-to-r from-gray-900 to-gray-700 px-6 py-8 text-white sm:px-8">
          <p className="text-[11px] tracking-widest text-gray-300 uppercase">Fix It · canje</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Calcula tu canje en minutos</h1>
          <p className="mt-3 max-w-2xl text-sm text-gray-100/90">
            Carga tu equipo, elegi el producto que queres y te mostramos la diferencia exacta a pagar.
          </p>
        </div>

        {!logged ? (
          <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Para cotizar canje necesitas <Link to="/login" className="font-medium underline">iniciar sesion</Link>.
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {success}
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
          <form onSubmit={handleCalcularPresupuesto} className="space-y-6">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-7">
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">1</span>
                <h2 className="text-base font-semibold text-gray-900">Tu equipo actual</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-gray-500">Modelo y capacidad</span>
                  <select
                    value={form.id_modelo_canje}
                    onChange={(ev) => setForm((prev) => ({ ...prev, id_modelo_canje: ev.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {modelosActivos.map((m) => (
                      <option key={m.id_modelo_canje} value={m.id_modelo_canje}>
                        {modelLabel(m)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-500">Bateria</span>
                  <select
                    value={form.bateria_intervalo}
                    onChange={(ev) => setForm((prev) => ({ ...prev, bateria_intervalo: ev.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                    disabled={loadingConfigCanje}
                    required
                  >
                    {!form.id_modelo_canje ? <option value="">Primero selecciona modelo...</option> : null}
                    {form.id_modelo_canje && intervalosBateria.length === 0 ? (
                      <option value="">Sin intervalos disponibles para este modelo</option>
                    ) : null}
                    {form.id_modelo_canje && intervalosBateria.length > 0 ? (
                      <option value="">Seleccionar intervalo...</option>
                    ) : null}
                    {intervalosBateria.map((cot) => {
                      const value = intervalValue(cot.bateria_min, cot.bateria_max)
                      return (
                        <option key={cot.id_cotizacion} value={value}>
                          {getBatteryIntervalLabel(cot.bateria_min, cot.bateria_max)}
                        </option>
                      )
                    })}
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-500">Estado estetico</span>
                  <select
                    value={form.estado_estetico}
                    onChange={(ev) => setForm((prev) => ({ ...prev, estado_estetico: ev.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {estadoOptions.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado.charAt(0).toUpperCase() + estado.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-gray-500">Estado funcional</span>
                  <select
                    value={form.estado_funcional}
                    onChange={(ev) => setForm((prev) => ({ ...prev, estado_funcional: ev.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {estadoOptions.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado.charAt(0).toUpperCase() + estado.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-gray-500">Observaciones</span>
                  <textarea
                    rows={3}
                    value={form.observaciones}
                    onChange={(ev) => setForm((prev) => ({ ...prev, observaciones: ev.target.value }))}
                    className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                    placeholder="Detalle extra que quieras sumar"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-gray-500">
                    Fotos de tu equipo (hasta 4)
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={(ev) => {
                      const selected = Array.from(ev.target.files ?? [])
                      if (selected.length > 4) {
                        setFotoError('Puedes seleccionar hasta 4 fotos. Se usarán las primeras 4.')
                      } else {
                        setFotoError(null)
                      }
                      const files = selected.slice(0, 4)
                      if (files.some((f) => f.size > 10 * 1024 * 1024)) {
                        setFotoError('Cada foto debe pesar hasta 10 MB.')
                        setEquipoFotos(files.filter((f) => f.size <= 10 * 1024 * 1024))
                        return
                      }
                      ev.currentTarget.value = ''
                      // Reemplaza la selección para evitar acumulaciones no deseadas.
                      // El usuario siempre ve exactamente las fotos que se enviarán.
                      setEquipoFotos(files)
                    }}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
                  />
                  {fotoError ? (
                    <p className="mt-2 text-xs font-medium text-amber-700">{fotoError}</p>
                  ) : null}
                  {equipoFotos.length > 0 ? (
                    <p className="mt-2 text-xs text-gray-500">
                      {equipoFotos.length} foto{equipoFotos.length > 1 ? 's' : ''} seleccionada
                      {equipoFotos.length > 1 ? 's' : ''}.
                    </p>
                  ) : null}
                  {equipoFotoPreviews.length > 0 ? (
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {equipoFotoPreviews.map(({ file, url }, idx) => (
                        <div key={`${file.name}-${idx}`} className="overflow-hidden rounded-xl border border-gray-200">
                          <img src={url} alt={`Foto equipo ${idx + 1}`} className="h-20 w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-1 text-xs text-gray-400">
                    Formatos permitidos: JPG, PNG y WEBP. Máximo 4 fotos, hasta 10 MB por imagen.
                  </p>
                </label>
              </div>

              {form.id_modelo_canje && !loadingConfigCanje && intervalosBateria.length === 0 ? (
                <p className="mt-3 text-xs text-amber-700">
                  Este modelo no tiene intervalos de bateria configurados para cotizar. Elegi otro modelo.
                </p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-7">
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">2</span>
                <h2 className="text-base font-semibold text-gray-900">Elegi el producto que queres</h2>
              </div>

              <div className="mb-4 inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
                {(['todos', 'nuevo', 'usado'] as const).map((filter) => {
                  const active = conditionFilter === filter
                  const label = filter === 'todos' ? 'Todos' : filter === 'nuevo' ? 'Nuevo' : 'Usado'
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setConditionFilter(filter)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-white hover:text-gray-900'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {loadingProductos ? (
                <p className="text-sm text-gray-500">Cargando productos...</p>
              ) : productosCanjeables.length === 0 ? (
                <p className="text-sm text-gray-500">No hay productos disponibles para canje por ahora.</p>
              ) : productosFiltrados.length === 0 ? (
                <p className="text-sm text-gray-500">No hay productos en esta categoria por ahora.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {productosFiltrados.map((prod) => {
                    const isSelected = selectedProductId === prod.id
                    const condition = getProductCondition(prod)
                    return (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => setSelectedProductId(prod.id)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          isSelected
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-200 bg-white text-gray-900 hover:border-gray-400'
                        }`}
                      >
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : condition === 'usado'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {conditionLabel(condition)}
                        </span>
                        <p className="text-sm font-semibold">{prod.nombre}</p>
                        <p className={`mt-1 text-sm ${isSelected ? 'text-gray-100' : 'text-gray-500'}`}>
                          {money(prod.precio)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={calculating || !logged || loadingConfigCanje}
              className="inline-flex items-center justify-center rounded-full bg-gray-900 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-60"
            >
              {calculating ? 'Calculando...' : 'Calcular diferencia'}
            </button>
          </form>

          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-7">
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">3</span>
                <h2 className="text-base font-semibold text-gray-900">Resultado del canje</h2>
              </div>

              {!presupuesto ? (
                <p className="text-sm leading-relaxed text-gray-500">
                  Completa los pasos 1 y 2 para ver el valor de toma de tu equipo y la diferencia exacta.
                </p>
              ) : (
                <>
                  <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-gray-500">Producto elegido</span>
                      <strong className="text-gray-900">{selectedProduct?.nombre ?? `#${presupuesto.id_producto_interes}`}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-gray-500">Precio producto</span>
                      <strong className="text-gray-900">{money(presupuesto.precio_producto_interes)}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-gray-500">Valor toma de tu equipo</span>
                      <strong className="text-gray-900">{money(presupuesto.valor_toma)}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-3 text-sm">
                      <span className="text-gray-700">Diferencia a pagar</span>
                      <strong className="text-lg text-gray-900">{money(presupuesto.diferencia_a_pagar)}</strong>
                    </div>
                  </div>

                  {presupuesto.aprobado ? (
                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                      Tu canje es viable. Si queres, podes enviar la solicitud ahora.
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      {presupuesto.mensaje_usuario}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!presupuesto.aprobado || creatingSolicitud}
                    onClick={() => void handleCrearSolicitud()}
                    className="mt-4 inline-flex items-center justify-center rounded-full bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-60"
                  >
                    {creatingSolicitud ? 'Enviando solicitud...' : 'Confirmar solicitud de canje'}
                  </button>
                </>
              )}
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">Como funciona</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-500">
                <li>1. Elegis modelo del catalogo y rango de bateria ya configurado.</li>
                <li>2. Elegis equipo nuevo o usado segun preferencia.</li>
                <li>3. Te mostramos la diferencia segun cotizacion vigente.</li>
                <li>4. Si te sirve, envias la solicitud y seguimos con validacion tecnica.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 text-sm text-gray-500">
          ¿Preferis publicar tu equipo para venta directa? <Link to="/publicar" className="font-medium text-gray-900 underline">Ir a publicar</Link>
        </div>
      </section>
    </div>
  )
}
