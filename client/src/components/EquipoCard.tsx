import type { EquipoConModelo } from '../types/inventario'
import { mediaUrl } from '../services/api'

interface EquipoCardProps {
  equipo: EquipoConModelo
  isActive: boolean
  onSelect: () => void
  onViewDetail: () => void
  onAddToCart: () => void
  canAddToCart: boolean
  addingToCart?: boolean
  dark?: boolean
}

function PhoneMockup({ dark = false }: { dark?: boolean }) {
  const bg = dark ? 'bg-gray-900' : 'bg-white'
  const border = dark ? 'border-gray-700' : 'border-gray-200'
  const screen = dark ? 'bg-gray-800' : 'bg-gray-100'
  const bar = dark ? 'bg-gray-700' : 'bg-gray-200'
  const notch = dark ? 'bg-black' : 'bg-gray-200'

  return (
    <div
      className={`relative mx-auto flex h-32 w-16 flex-col items-center rounded-[1.5rem] border border-[1.5px] ${bg} ${border} pb-2 pt-2 shadow-sm`}
    >
      <div className={`mb-1 h-2.5 w-7 rounded-full ${notch}`} />
      <div className={`w-[88%] flex-1 space-y-1 overflow-hidden rounded-lg ${screen} p-1.5`}>
        <div className={`h-1 w-3/4 rounded-full ${bar}`} />
        <div className={`h-1 w-1/2 rounded-full ${bar} opacity-60`} />
        <div className={`mt-1.5 h-8 rounded-md ${bar} opacity-40`} />
        <div className={`h-1 w-5/6 rounded-full ${bar} opacity-50`} />
      </div>
      <div className={`mt-1.5 h-0.5 w-6 rounded-full ${bar}`} />
    </div>
  )
}

export function EquipoCard({
  equipo,
  isActive,
  onSelect,
  onViewDetail,
  onAddToCart,
  canAddToCart,
  addingToCart = false,
  dark = false,
}: EquipoCardProps) {
  const title = equipo.modelo?.nombre_modelo ?? `Modelo ${equipo.id_modelo}`
  const subtitle = equipo.estado_comercial
    ? `Estado: ${equipo.estado_comercial}`
    : 'Equipo disponible'

  return (
    <article
      className={`w-[220px] flex-none snap-start rounded-2xl border bg-white p-3 shadow-sm transition-colors sm:w-[250px] md:w-[280px] ${
        isActive ? 'border-gray-300' : 'border-gray-100'
      }`}
      data-slide="1"
    >
      <button type="button" onClick={onSelect} className="mb-3 block w-full text-left">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="aspect-[4/5] w-full flex items-center justify-center overflow-hidden">
            {equipo.foto_url ? (
              <img src={mediaUrl(equipo.foto_url)} alt={title} className="h-full w-full object-cover" />
            ) : (
              <PhoneMockup dark={dark} />
            )}
          </div>
        </div>
      </button>

      <div className="px-1">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h3 className="line-clamp-2 text-sm leading-tight font-bold text-gray-900">{title}</h3>
          <span className="flex-shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 uppercase">
            {equipo.estado_comercial ?? 'nuevo'}
          </span>
        </div>
        <p className="mb-3 text-xs text-gray-500">{subtitle}</p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onViewDetail}
            className="rounded-lg border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900"
          >
            Ver detalle
          </button>
          <button
            type="button"
            onClick={onAddToCart}
            disabled={!canAddToCart || addingToCart}
            className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
              !canAddToCart
                ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                : addingToCart
                  ? 'cursor-wait bg-gray-500 text-white'
                  : 'bg-gray-900 text-white hover:bg-gray-700'
            }`}
          >
            {addingToCart ? 'Agregando...' : 'Agregar'}
          </button>
        </div>
        {!canAddToCart && (
          <p className="mt-2 text-[11px] text-amber-600">Este equipo no tiene producto vinculado.</p>
        )}
      </div>
    </article>
  )
}
