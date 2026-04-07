import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EquipoConModelo } from '../../types/inventario'
import { inventarioApi } from '../../services/inventarioApi'
import { mediaUrl } from '../../services/api'

function isIphone(nombre: string | null | undefined): boolean {
  const s = (nombre ?? '').trim().toLowerCase()
  return s.includes('iphone')
}

function isNuevo(estado: string | null | undefined): boolean {
  const s = (estado ?? '').trim().toLowerCase()
  return s === 'nuevo' || s.startsWith('nuevo')
}

const FEATURES = [
  {
    title: 'Pro Camera',
    desc: 'Multi-lens array with AI scene detection. Capture every detail.',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
      </svg>
    ),
  },
  {
    title: 'All-Day Battery',
    desc: 'Charge in minutes. Power that lasts from sunrise to midnight.',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
        />
      </svg>
    ),
  },
  {
    title: 'Performance',
    desc: 'Next-gen chipsets tuned for speed. Gaming, work, creativity.',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
    ),
  },
  {
    title: 'Privacy First',
    desc: 'Hardware-level security. On-device AI keeps your data yours.',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    ),
  },
]

function PhoneMockup({ dark = false }: { dark?: boolean }) {
  const bg = dark ? 'bg-gray-900' : 'bg-white'
  const border = dark ? 'border-gray-700' : 'border-gray-200'
  const screen = dark ? 'bg-gray-800' : 'bg-gray-100'
  const bar = dark ? 'bg-gray-700' : 'bg-gray-200'
  const notch = dark ? 'bg-black' : 'bg-gray-200'

  return (
    <div
      className={`relative mx-auto flex h-56 w-28 flex-col items-center rounded-[2rem] border border-[1.5px] ${bg} ${border} pb-3 pt-3 shadow-sm`}
    >
      <div className={`mb-2 h-4 w-12 rounded-full ${notch}`} />
      <div className={`w-[88%] flex-1 space-y-1.5 overflow-hidden rounded-xl ${screen} p-2`}>
        <div className={`h-1.5 w-3/4 rounded-full ${bar}`} />
        <div className={`h-1.5 w-1/2 rounded-full ${bar} opacity-60`} />
        <div className={`mt-2 h-12 rounded-lg ${bar} opacity-40`} />
        <div className={`h-1.5 w-5/6 rounded-full ${bar} opacity-50`} />
        <div className={`h-1.5 w-2/3 rounded-full ${bar} opacity-40`} />
      </div>
      <div className={`mt-2 h-1 w-10 rounded-full ${bar}`} />
    </div>
  )
}

export default function Home() {
  const [active, setActive] = useState(0)
  const [equipos, setEquipos] = useState<EquipoConModelo[]>([])
  const [loadingEquipos, setLoadingEquipos] = useState(true)
  const [equiposError, setEquiposError] = useState<string | null>(null)
  const sliderRef = useRef<HTMLDivElement | null>(null)
  const [sliderIndex, setSliderIndex] = useState(0)

  useEffect(() => {
    let alive = true
    async function load() {
      setEquiposError(null)
      setLoadingEquipos(true)
      try {
        const eq = await inventarioApi.equipos.list(0, 100)
        if (!alive) return
        setEquipos(eq)
      } catch (e) {
        if (!alive) return
        setEquiposError(e instanceof Error ? e.message : 'Error al cargar equipos')
      } finally {
        if (!alive) return
        setLoadingEquipos(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  function scrollToIndex(next: number) {
    const el = sliderRef.current
    if (!el) return
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-slide="1"]'))
    const target = items[next]
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
    setSliderIndex(next)
  }

  function handleSliderScroll() {
    const el = sliderRef.current
    if (!el) return
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-slide="1"]'))
    if (items.length === 0) return
    const left = el.scrollLeft
    // Encontramos el slide cuyo offsetLeft esté más cerca de scrollLeft.
    let bestIdx = 0
    let bestDist = Number.POSITIVE_INFINITY
    for (let i = 0; i < items.length; i++) {
      const d = Math.abs(items[i].offsetLeft - left)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    setSliderIndex(bestIdx)
  }

  const equiposPresentados = useMemo(() => {
    // Home (iPhone): SOLO "Nuevo" y sin repetidos por modelo.
    // Orden: primero con foto, luego más reciente.
    const base = equipos.filter(
      (e) =>
        e.activo &&
        isIphone(e.modelo?.nombre_modelo ?? null) &&
        isNuevo(e.estado_comercial),
    )

    const sorted = [...base].sort((a, b) => {
      const af = a.foto_url ? 1 : 0
      const bf = b.foto_url ? 1 : 0
      if (af !== bf) return bf - af
      return (b.fecha_ingreso ?? '').localeCompare(a.fecha_ingreso ?? '')
    })

    const seen = new Set<number>()
    const out: EquipoConModelo[] = []
    for (const e of sorted) {
      // Dedupe por modelo (id_modelo). Si por alguna razón falta, cae a id_equipo.
      const key = Number.isFinite(e.id_modelo) ? e.id_modelo : e.id_equipo
      if (seen.has(key)) continue
      seen.add(key)
      out.push(e)
    }
    return out
  }, [equipos])

  useEffect(() => {
    // Cuando cambia la data, reseteamos el slider.
    setSliderIndex(0)
    const el = sliderRef.current
    if (!el) return
    el.scrollTo({ left: 0, behavior: 'instant' as ScrollBehavior })
  }, [equiposPresentados.length])

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-16 px-6 pb-24 pt-20 lg:grid-cols-2">
        <div>
          <span className="mb-7 inline-block rounded-full border border-gray-200 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-gray-400 uppercase">
            2026 Lineup
          </span>
          <h1 className="mb-5 text-5xl leading-[1.02] font-black tracking-tight text-gray-900 sm:text-6xl">
            The future
            <br />
            <span className="text-gray-300">fits in your</span>
            <br />
            pocket.
          </h1>
          <p className="mb-9 max-w-sm text-base leading-relaxed text-gray-400">
            Nexus smartphones combine cutting-edge hardware with seamless software—built for people who refuse to
            compromise.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/marketplace"
              className="rounded-full bg-gray-900 px-7 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-gray-700"
            >
              Ver usados
            </Link>
            <Link
              to="/publicar"
              className="rounded-full border border-gray-200 px-7 py-3 text-sm font-medium text-gray-500 transition-colors duration-150 hover:border-gray-400 hover:text-gray-900"
            >
              Vender mi celular
            </Link>
          </div>

          <div className="mt-12 flex gap-8 border-t border-gray-100 pt-8">
            {[
              { value: '12M+', label: 'Users worldwide' },
              { value: '4.9★', label: 'Average rating' },
              { value: '150+', label: 'Countries' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-xl font-black text-gray-900">{s.value}</p>
                <p className="mt-0.5 text-xs text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex h-64 items-end justify-center gap-3">
          {[false, true, false].map((dark, i) => (
            <div
              key={i}
              onClick={() => setActive(i)}
              className={`cursor-pointer transition-all duration-400 ${
                i === active ? 'z-10 scale-110 -translate-y-5' : 'scale-90 opacity-40 hover:opacity-60'
              }`}
            >
              <PhoneMockup dark={dark} />
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-gray-100" />

      <section className="mx-auto max-w-6xl px-6 pt-10 pb-16">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-1.5 text-[11px] tracking-widest text-gray-300 uppercase">Lineup</p>
          </div>
          <Link to="/marketplace" className="text-sm text-gray-400 transition-colors duration-150 hover:text-gray-900">
            Ver usados →
          </Link>
        </div>

        {loadingEquipos ? (
          <div className="rounded-3xl border border-gray-100 bg-white p-6 text-gray-400">Cargando equipos…</div>
        ) : equiposError ? (
          <div className="rounded-3xl border border-gray-100 bg-white p-6 text-red-500">{equiposError}</div>
        ) : equiposPresentados.length === 0 ? (
          <div className="rounded-3xl border border-gray-100 bg-white p-6 text-gray-400">
            Todavía no hay equipos “Nuevo” activos cargados.
          </div>
        ) : (
          <div>
            <div className="mb-8">
              <h3 className="mb-5 text-6xl font-black tracking-tight text-gray-900">iPhone</h3>

              <div className="flex items-start gap-10 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {equiposPresentados.map((eq) => {
                  const title = eq.modelo?.nombre_modelo ?? `Modelo ${eq.id_modelo}`
                  const isActive = equiposPresentados[sliderIndex]?.id_equipo === eq.id_equipo
                  const idx = equiposPresentados.findIndex((e) => e.id_equipo === eq.id_equipo)
                  const onClick = () => {
                    if (idx >= 0) scrollToIndex(idx)
                  }

                  return (
                    <button
                      key={`presentado-${eq.id_equipo}`}
                      type="button"
                      onClick={onClick}
                      className="group flex w-[120px] flex-none flex-col items-center gap-3 text-center"
                      title={title}
                    >
                      <div
                        className={`h-20 w-20 overflow-hidden rounded-2xl bg-transparent transition-opacity duration-150 ${
                          isActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'
                        }`}
                      >
                        {eq.foto_url ? (
                          <img
                            src={mediaUrl(eq.foto_url)}
                            alt={title}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-300">
                            —
                          </div>
                        )}
                      </div>
                      <div className="line-clamp-2 text-[13px] font-semibold leading-snug text-gray-700">
                        {title}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mb-6 flex items-end justify-between">
              <h3 className="text-4xl font-black tracking-tight text-gray-900">Conocé a la familia.</h3>
              <Link
                to="/marketplace"
                className="text-sm text-gray-400 transition-colors duration-150 hover:text-gray-900"
              >
                Comparar todos los modelos ›
              </Link>
            </div>

            <div
              ref={sliderRef}
              onScroll={handleSliderScroll}
              className="flex gap-4 overflow-x-auto scroll-smooth pb-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {equiposPresentados.map((eq, idx) => {
                const title = eq.modelo?.nombre_modelo ?? `Modelo ${eq.id_modelo}`
                const subtitle =
                  eq.modelo?.descripcion?.trim() ||
                  (eq.estado_comercial ? `Estado: ${eq.estado_comercial}` : 'Equipo disponible')

                return (
                  <div
                    key={eq.id_equipo}
                    data-slide="1"
                    className="w-[280px] flex-none sm:w-[320px] md:w-[360px]"
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    <div className="relative overflow-hidden rounded-[2.25rem] bg-gray-100">
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10" />
                      <div className="relative h-[280px] w-full">
                        {eq.foto_url ? (
                          <img
                            src={mediaUrl(eq.foto_url)}
                            alt={title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <PhoneMockup dark={idx % 3 === 0} />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-black text-gray-900">{title}</p>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-gray-500 uppercase">
                          Nuevo
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-center gap-2">
              {equiposPresentados.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Ir a celular ${i + 1}`}
                  onClick={() => scrollToIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === sliderIndex ? 'w-6 bg-gray-900' : 'w-3 bg-gray-200 hover:bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="border-t border-gray-100">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12">
            <p className="mb-1.5 text-[11px] tracking-widest text-gray-300 uppercase">Why Nexus</p>
            <h2 className="text-3xl font-black tracking-tight text-gray-900">Built different.</h2>
          </div>

          <div className="grid gap-px bg-gray-100 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white p-7 transition-colors duration-150 hover:bg-gray-50">
                <div className="mb-4 text-gray-400">{f.icon}</div>
                <h3 className="mb-2 text-sm font-bold text-gray-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-3xl bg-gray-900 px-10 py-14 text-center">
          <span className="mb-6 inline-block rounded-full border border-gray-700 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
            Limited offer
          </span>
          <h2 className="mb-3 text-4xl font-black tracking-tight text-white">Trade in & save up to $400</h2>
          <p className="mx-auto mb-8 max-w-md text-base leading-relaxed text-gray-400">
            Bring your old device, get an instant credit toward any Nexus smartphone. No hassle, no waiting.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button className="rounded-full bg-white px-8 py-3 text-sm font-medium text-gray-900 transition-colors duration-150 hover:bg-gray-100">
              Start trade-in
            </button>
            <button className="rounded-full border border-gray-700 px-8 py-3 text-sm font-medium text-gray-400 transition-colors duration-150 hover:border-gray-500 hover:text-white">
              Learn more
            </button>
          </div>
        </div>
      </section>
    </>
  )
}