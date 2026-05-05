import { useState, useEffect } from 'react'

// iPhone — Línea 13
import ip13 from '../../assets/comparativa/Linea 13/IP13-Negro.jpg'
import ip13Pro from '../../assets/comparativa/Linea 13/IP13Pro-Negro.jpg'
// iPhone — Línea 14
import ip14 from '../../assets/comparativa/Linea 14/IP14-Negro.jpg'
import ip14Pro from '../../assets/comparativa/Linea 14/IP14Pro-Blanco.jpg'
// iPhone — Línea 15
import ip15 from '../../assets/comparativa/Linea 15/IP15-Negro.jpg'
import ip15Pro from '../../assets/comparativa/Linea 15/IP15Pro-Negro.jpg'
// iPhone — Línea 16
import ip16 from '../../assets/comparativa/Linea 16/IP16-Negro.jpg'
import ip16Pro from '../../assets/comparativa/Linea 16/IP16Pro-Negro.jpg'
// iPhone — Línea 17
import ip17 from '../../assets/comparativa/Linea 17/IP17-negro.jpg'
import ip17Pro from '../../assets/comparativa/Linea 17/IP17Pro-Blanco.jpg'
// MacBook
import macAir from '../../assets/comparativa/Macbook/Air/Silver.jpg'
import macPro from '../../assets/comparativa/Macbook/Pro/plata.jpg'
// iPad
import ipadImg from '../../assets/comparativa/IPads/IPads.jpg'

type Category = 'iphone' | 'ipad' | 'macbook'

type ModelSpec = {
  id: string
  name: string
  image: string
  pantalla: string
  hz: string
  bateria: string
  zoom?: string
  chip?: string
  cargador: string
}

type SpecRow = { key: keyof ModelSpec; label: string }

const IPHONE_MODELS: ModelSpec[] = [
  { id: 'ip13',       name: 'iPhone 13',         image: ip13,    pantalla: '6.1"', hz: '60 Hz',  zoom: '0.5x – 2x',    bateria: 'Buena',         cargador: 'Lightning' },
  { id: 'ip13pro',    name: 'iPhone 13 Pro',      image: ip13Pro, pantalla: '6.1"', hz: '120 Hz', zoom: '3x',            bateria: 'Muy buena',      cargador: 'Lightning' },
  { id: 'ip13promax', name: 'iPhone 13 Pro Max',  image: ip13Pro, pantalla: '6.7"', hz: '120 Hz', zoom: '3x',            bateria: '🔥 Excelente',   cargador: 'Lightning' },
  { id: 'ip14',       name: 'iPhone 14',          image: ip14,    pantalla: '6.1"', hz: '60 Hz',  zoom: '0.5x – 2x',    bateria: 'Mejor',          cargador: 'Lightning' },
  { id: 'ip14pro',    name: 'iPhone 14 Pro',      image: ip14Pro, pantalla: '6.1"', hz: '120 Hz', zoom: '3x',            bateria: 'Muy buena',      cargador: 'Lightning' },
  { id: 'ip14promax', name: 'iPhone 14 Pro Max',  image: ip14Pro, pantalla: '6.7"', hz: '120 Hz', zoom: '3x',            bateria: '🔥 Excelente',   cargador: 'Lightning' },
  { id: 'ip15',       name: 'iPhone 15',          image: ip15,    pantalla: '6.1"', hz: '60 Hz',  zoom: '0.5x – 2x',    bateria: 'Igual',          cargador: 'USB-C' },
  { id: 'ip15pro',    name: 'iPhone 15 Pro',      image: ip15Pro, pantalla: '6.1"', hz: '120 Hz', zoom: '3x',            bateria: 'Muy buena',      cargador: 'USB-C' },
  { id: 'ip15promax', name: 'iPhone 15 Pro Max',  image: ip15Pro, pantalla: '6.7"', hz: '120 Hz', zoom: '5x',            bateria: '🔥 Excelente',   cargador: 'USB-C' },
  { id: 'ip16',       name: 'iPhone 16',          image: ip16,    pantalla: '6.1"', hz: '60 Hz',  zoom: '0.5x – 2x',    bateria: 'Mejor',          cargador: 'USB-C' },
  { id: 'ip16pro',    name: 'iPhone 16 Pro',      image: ip16Pro, pantalla: '6.3"', hz: '120 Hz', zoom: '5x',            bateria: 'Mejorada',       cargador: 'USB-C' },
  { id: 'ip16promax', name: 'iPhone 16 Pro Max',  image: ip16Pro, pantalla: '6.9"', hz: '120 Hz', zoom: '5x',            bateria: '🔥 Top',         cargador: 'USB-C' },
  { id: 'ip17',       name: 'iPhone 17',          image: ip17,    pantalla: '6.3"', hz: '60 Hz',  zoom: '2x',            bateria: 'Muy buena',      cargador: 'USB-C' },
  { id: 'ip17pro',    name: 'iPhone 17 Pro',      image: ip17Pro, pantalla: '6.3"', hz: '120 Hz', zoom: '🔥 hasta 8x',   bateria: 'Muy buena',      cargador: 'USB-C' },
  { id: 'ip17promax', name: 'iPhone 17 Pro Max',  image: ip17Pro, pantalla: '6.9"', hz: '120 Hz', zoom: '🔥🔥 hasta 8x', bateria: '🔥 Top',         cargador: 'USB-C' },
]

const IPAD_MODELS: ModelSpec[] = [
  { id: 'ipad',    name: 'iPad',      image: ipadImg, pantalla: '10.9"',      hz: '60 Hz',  chip: 'A14 Bionic',      bateria: 'Buena',         cargador: 'USB-C' },
  { id: 'ipadair', name: 'iPad Air',  image: ipadImg, pantalla: '11" / 13"',  hz: '60 Hz',  chip: 'M2 / M3 / M4',   bateria: 'Muy buena 🔥',  cargador: 'USB-C' },
  { id: 'ipadpro', name: 'iPad Pro',  image: ipadImg, pantalla: '11" / 13"',  hz: '120 Hz', chip: 'M4',              bateria: '🔥🔥 Top',      cargador: 'USB-C' },
]

const MACBOOK_MODELS: ModelSpec[] = [
  { id: 'macbookair', name: 'MacBook Air', image: macAir, pantalla: '13.6" / 15.3"', hz: '60 Hz',  chip: 'M1 / M2 / M3 / M4',          bateria: 'Muy buena 🔥', cargador: 'USB-C' },
  { id: 'macbookpro', name: 'MacBook Pro', image: macPro, pantalla: '14.2" / 16.2"', hz: '120 Hz', chip: 'M1 Pro – M4 Pro / Max',       bateria: '🔥🔥 Top',     cargador: 'USB-C' },
  { id: 'macbookneo', name: 'MacBook Neo', image: macAir, pantalla: '13" aprox.',    hz: '60 Hz',  chip: 'M2 / M3',                     bateria: 'Buena',        cargador: 'USB-C' },
]

const MODELS_MAP: Record<Category, ModelSpec[]> = {
  iphone: IPHONE_MODELS,
  ipad: IPAD_MODELS,
  macbook: MACBOOK_MODELS,
}

const IPHONE_SPECS: SpecRow[] = [
  { key: 'pantalla', label: 'Pantalla' },
  { key: 'hz',       label: 'Hz' },
  { key: 'zoom',     label: 'Zoom óptico' },
  { key: 'bateria',  label: 'Batería' },
  { key: 'cargador', label: 'Conector' },
]

const OTHER_SPECS: SpecRow[] = [
  { key: 'pantalla', label: 'Pantalla' },
  { key: 'hz',       label: 'Hz' },
  { key: 'chip',     label: 'Chip' },
  { key: 'bateria',  label: 'Batería' },
  { key: 'cargador', label: 'Conector' },
]

const CATEGORY_LABELS: Record<Category, string> = {
  iphone: 'iPhone',
  ipad: 'iPad',
  macbook: 'MacBook',
}

const MAX_DESKTOP = 3
const MAX_MOBILE = 2

function CheckIcon() {
  return (
    <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'h-4 w-4'} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export default function ComparativaPage() {
  const [category, setCategory] = useState<Category>('iphone')
  const [selected, setSelected] = useState<string[]>([])
  const [maxSlots, setMaxSlots] = useState(MAX_DESKTOP)

  useEffect(() => {
    const update = () => {
      const newMax = window.innerWidth < 768 ? MAX_MOBILE : MAX_DESKTOP
      setMaxSlots(newMax)
      setSelected(prev => prev.slice(0, newMax))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const models = MODELS_MAP[category]
  const specs = category === 'iphone' ? IPHONE_SPECS : OTHER_SPECS

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat)
    setSelected([])
  }

  const toggleModel = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= maxSlots) return prev
      return [...prev, id]
    })
  }

  const removeModel = (id: string) => setSelected(prev => prev.filter(x => x !== id))

  const selectedModels = selected
    .map(id => models.find(m => m.id === id))
    .filter((m): m is ModelSpec => !!m)

  const showTable = selectedModels.length >= 2

  const labelColWidth = maxSlots === MAX_MOBILE ? '80px' : '120px'
  const gridCols = `${labelColWidth} repeat(${selectedModels.length}, 1fr)`

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ── */}
      <div className="border-b border-neutral-100 px-6 py-14 text-center">
        <p className="mb-2 text-[10px] font-medium tracking-[0.22em] text-neutral-400 uppercase">
          Comparativa
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-neutral-900 sm:text-5xl">
          Comparar modelos
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-neutral-500">
          Seleccioná hasta {maxSlots} modelos del mismo tipo para ver sus diferencias lado a lado.
        </p>
      </div>

      {/* ── Category tabs ── */}
      <div className="sticky top-0 z-10 border-b border-neutral-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl justify-center gap-1 px-6 py-3">
          {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${
                category === cat
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Model selection grid ── */}
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">
            Elegí los modelos
          </h2>
          <span className="text-sm text-neutral-400">
            {selected.length} / {maxSlots}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
          {models.map(model => {
            const isSelected = selected.includes(model.id)
            const isDisabled = !isSelected && selected.length >= maxSlots
            return (
              <button
                key={model.id}
                onClick={() => !isDisabled && toggleModel(model.id)}
                disabled={isDisabled}
                className={`relative rounded-2xl border-2 p-3 text-center transition-all duration-200 ${
                  isSelected
                    ? 'border-[#0071e3] bg-blue-50/40 shadow-[0_0_0_1px_#0071e3]'
                    : isDisabled
                    ? 'cursor-not-allowed border-neutral-100 opacity-35'
                    : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#0071e3]">
                    <CheckIcon />
                  </span>
                )}
                <div className="mb-2 flex h-[72px] items-center justify-center sm:h-[88px]">
                  <img
                    src={model.image}
                    alt={model.name}
                    className="max-h-full max-w-full object-contain mix-blend-multiply"
                    loading="lazy"
                  />
                </div>
                <p className="text-[10px] font-medium leading-tight text-neutral-700 sm:text-[11px]">
                  {model.name}
                </p>
              </button>
            )
          })}
        </div>

        {selected.length === 0 && (
          <p className="mt-5 text-center text-sm text-neutral-400">
            Tocá los modelos que querés comparar
          </p>
        )}
        {selected.length === 1 && (
          <p className="mt-5 text-center text-sm text-neutral-400">
            Seleccioná al menos un modelo más para ver la comparativa
          </p>
        )}
      </div>

      {/* ── Comparison table ── */}
      {showTable && (
        <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
          <div className="overflow-x-auto rounded-3xl border border-neutral-200/60 bg-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.10)]">

            {/* Model header row */}
            <div
              className="grid border-b border-neutral-100"
              style={{ gridTemplateColumns: gridCols }}
            >
              {/* Empty corner */}
              <div className="p-4" />

              {selectedModels.map(model => (
                <div key={model.id} className="flex flex-col items-center px-3 pt-4 pb-5 sm:px-5 sm:pt-5 sm:pb-6">
                  <button
                    onClick={() => removeModel(model.id)}
                    className="mb-2 self-end rounded-full p-1 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                    aria-label={`Quitar ${model.name}`}
                  >
                    <XIcon />
                  </button>
                  <div className="flex h-[110px] w-full items-center justify-center sm:h-[140px]">
                    <img
                      src={model.image}
                      alt={model.name}
                      className="max-h-full max-w-[75%] object-contain mix-blend-multiply"
                    />
                  </div>
                  <p className="mt-3 text-center text-[13px] font-semibold tracking-[-0.01em] text-neutral-900 sm:text-[14px]">
                    {model.name}
                  </p>
                </div>
              ))}
            </div>

            {/* Spec rows */}
            {specs.map((spec, i) => (
              <div
                key={spec.key}
                className={`grid border-b border-neutral-100 last:border-0 ${
                  i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/60'
                }`}
                style={{ gridTemplateColumns: gridCols }}
              >
                <div className="flex items-center px-4 py-4 sm:px-5 sm:py-5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 sm:text-[11px]">
                    {spec.label}
                  </span>
                </div>
                {selectedModels.map(model => (
                  <div key={model.id} className="flex items-center justify-center px-2 py-4 sm:px-4 sm:py-5">
                    <span className="text-center text-[13px] font-medium leading-snug text-neutral-800 sm:text-sm">
                      {(model[spec.key] as string) ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Add more hint */}
          {selectedModels.length < maxSlots && (
            <p className="mt-5 text-center text-sm text-neutral-400">
              Podés agregar {maxSlots - selectedModels.length} modelo{maxSlots - selectedModels.length > 1 ? 's' : ''} más
            </p>
          )}
        </div>
      )}
    </div>
  )
}
