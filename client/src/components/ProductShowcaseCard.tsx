import { Link } from 'react-router-dom'
import { mediaUrl } from '../services/api'

function fmtArs(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'string' ? Number(String(v).trim().replace(',', '.')) : v
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtUsd(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function ProductMockup() {
  return (
    <div className="relative mx-auto flex h-44 w-24 flex-col items-center rounded-[1.9rem] border border-[1.5px] border-gray-200 bg-white pb-2.5 pt-2.5 shadow-sm">
      <div className="mb-1.5 h-3.5 w-10 rounded-full bg-gray-200" />
      <div className="w-[88%] flex-1 space-y-1 overflow-hidden rounded-xl bg-gray-100 p-2">
        <div className="h-1.5 w-3/4 rounded-full bg-gray-200" />
        <div className="h-1.5 w-1/2 rounded-full bg-gray-200 opacity-60" />
        <div className="mt-2 h-14 rounded-lg bg-gray-200 opacity-40" />
      </div>
      <div className="mt-2 h-1 w-8 rounded-full bg-gray-200" />
    </div>
  )
}

type ProductShowcaseCardProps = {
  title: string
  description?: string | null
  familyLabel: string
  imageUrl?: string | null
  badgeTag?: string
  arsPrice?: string | number | null
  usdPrice?: string | number | null
  stockLabel?: string | null
  primaryAction?: {
    label: string
    onClick: () => void
    disabled?: boolean
  }
  detailTo: string
}

export function ProductShowcaseCard({
  title,
  description,
  familyLabel,
  imageUrl,
  badgeTag = 'Apple',
  arsPrice,
  usdPrice,
  stockLabel,
  primaryAction,
  detailTo,
}: ProductShowcaseCardProps) {
  const src = mediaUrl(imageUrl)
  const hasUsd = usdPrice !== null && usdPrice !== undefined && usdPrice !== ''

  return (
    <article className="flex flex-col items-center text-center">
      <div className="relative w-full overflow-hidden rounded-[2rem] bg-gradient-to-b from-neutral-200/90 via-stone-100/80 to-white shadow-[0_12px_48px_-20px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.03]">
        <div className="relative flex h-[280px] w-full items-center justify-center sm:h-[320px] md:h-[340px]">
          {src ? (
            <img
              src={src}
              alt={title}
              className="max-h-full w-auto max-w-[min(100%,280px)] object-contain object-center mix-blend-multiply sm:max-w-[300px] md:max-w-[320px]"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ProductMockup />
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex justify-center gap-2.5 sm:mt-4" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full ring-1 ring-black/[0.08] bg-stone-200" />
        <span className="h-2.5 w-2.5 rounded-full ring-1 ring-black/[0.08] bg-neutral-100" />
        <span className="h-2.5 w-2.5 rounded-full ring-1 ring-black/[0.08] bg-slate-800" />
      </div>

      <p className="mt-3 text-[11px] font-semibold tracking-[0.02em] text-neutral-500 uppercase">{badgeTag}</p>

      <h3 className="mt-1.5 max-w-[18rem] text-[1.375rem] font-semibold leading-tight tracking-[-0.025em] text-neutral-900 sm:text-[1.5rem]">
        {title}
      </h3>

      <p className="mt-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">{familyLabel}</p>

      {description ? (
        <p className="mx-auto mt-2.5 max-w-[20rem] text-[15px] leading-snug text-neutral-600">
          {description}
        </p>
      ) : null}

      <div className="mx-auto mt-3 flex max-w-[22rem] flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
        {hasUsd ? (
          <span className="inline-flex items-center rounded-full bg-[#0071e3]/10 px-3 py-1 text-[13px] font-semibold text-[#0071e3]">
            USD {fmtUsd(usdPrice).replace('$', '').trim()}
          </span>
        ) : null}
        {arsPrice !== undefined ? (
          <span className={`${hasUsd ? 'text-xs text-neutral-500' : 'text-xs text-neutral-700 sm:text-[13px]'}`}>
            {hasUsd ? `ARS ${fmtArs(arsPrice).replace('$', '').trim()}` : fmtArs(arsPrice)}
          </span>
        ) : null}
      </div>

      {stockLabel ? <p className="mt-2 text-xs font-medium text-neutral-500">{stockLabel}</p> : null}

      <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
        {primaryAction ? (
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className="inline-flex min-h-[2.75rem] min-w-[9rem] items-center justify-center rounded-full bg-[#0071e3] px-7 text-[15px] font-normal text-white transition-colors hover:bg-[#0077ed] active:bg-[#006edb] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {primaryAction.label}
          </button>
        ) : null}
        <Link
          to={detailTo}
          className="inline-flex items-center gap-0.5 text-[15px] font-normal text-[#0071e3] transition-colors hover:underline"
        >
          Ver detalle
          <span aria-hidden className="text-lg leading-none">
            ›
          </span>
        </Link>
      </div>
    </article>
  )
}
