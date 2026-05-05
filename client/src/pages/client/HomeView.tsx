import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import fixitHeroVideo from '../../assets/fixit-hero.mp4'
import familyIphone17Pro from '../../assets/family-iphone-17-pro.png'
import familyMacbook from '../../assets/family-macbook.png'
import familyIpad from '../../assets/family-ipad.png'

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.25, 0.1, 0.25, 1], delay },
  }),
}

const FEATURES = [
  {
    title: 'Equipos verificados',
    desc: 'Cada equipo pasa controles para que sepas el estado real antes de comprar: sin sorpresas.',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Garantía y soporte',
    desc: 'Respaldamos tu compra con garantía y atención para que uses tu tecnología con tranquilidad.',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: 'Reparaciones',
    desc: 'Pantallas, baterías y más. Servicio técnico en un solo lugar, con la confianza de Fix It.',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655-5.653a2.548 2.548 0 010-3.586l4.101-4.101a2.548 2.548 0 013.586 0l5.653 4.655" />
      </svg>
    ),
  },
  {
    title: 'Precios transparentes',
    desc: 'Usados, nuevos y marketplace con condiciones claras. Sin letras chicas innecesarias.',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
] as const

type FamilyItem = {
  id: string
  title: string
  image: string
  imageBackdrop: string
  swatches: readonly string[]
  isNew?: boolean
  line1: string
  line2: string
  price: string
}

const FAMILY_LINEUP: FamilyItem[] = [
  {
    id: '17-pro',
    title: 'iPhone 17 Pro',
    isNew: true,
    imageBackdrop: 'bg-gradient-to-b from-neutral-200/90 via-stone-100/80 to-white',
    swatches: ['bg-stone-200', 'bg-neutral-100', 'bg-slate-800'],
    line1: 'Potencia pro. Cámaras que marcan la diferencia.',
    line2: 'Titanium, ProMotion y soporte técnico Fix It.',
    price: 'Consultá precio según stock · Financiación disponible.',
    image: familyIphone17Pro,
  },
  {
    id: 'macbook',
    title: 'MacBook Air',
    imageBackdrop: 'bg-gradient-to-b from-sky-200/50 via-blue-50/60 to-white',
    swatches: ['bg-slate-200', 'bg-sky-200', 'bg-neutral-900'],
    line1: 'Potencia para estudiar, trabajar y crear.',
    line2: 'Consultá modelos disponibles y condiciones.',
    price: 'Stock sujeto a disponibilidad · Financiación disponible.',
    image: familyMacbook,
  },
  {
    id: 'ipad',
    title: 'iPad',
    imageBackdrop: 'bg-gradient-to-b from-emerald-100/60 via-teal-50/70 to-white',
    swatches: ['bg-emerald-100', 'bg-sky-100', 'bg-neutral-800'],
    line1: 'Versátil y liviano. Ideal para todos los días.',
    line2: 'Te ayudamos a elegir según uso y presupuesto.',
    price: 'Consultá stock y precios por WhatsApp.',
    image: familyIpad,
  },
]

export default function Home() {
  const lineupAnchorRef = useRef<HTMLDivElement | null>(null)

  return (
    <>
      {/* ── Hero ── */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-20 pt-4 sm:gap-12 sm:pt-6 lg:grid-cols-2 lg:gap-16 lg:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <span className="mb-5 inline-block rounded-full border border-gray-200 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-gray-400 uppercase sm:mb-6">
            Nuevos · usados · reparaciones · marketplace
          </span>
          <h1 className="mb-5 text-5xl leading-[1.02] font-black tracking-tight text-gray-900 sm:text-6xl">
            Tu próximo equipo,
            <br />
            <span className="text-gray-300">con garantía de confianza </span>
            Fix It.
          </h1>
          <p className="mb-9 max-w-sm text-base leading-relaxed text-gray-400">
            La forma más inteligente de renovar tu tecnología. Equipos verificados, precios justos y soporte técnico
            especializado en un solo lugar.
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1], delay: 0.12 }}
          className="relative min-w-0"
        >
          <video
            className="h-[320px] w-full object-cover sm:h-[380px] lg:h-[460px]"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-label="Fix It"
          >
            <source src={fixitHeroVideo} type="video/mp4" />
          </video>
        </motion.div>
      </section>

      <div className="border-t border-neutral-200/60" />

      {/* ── Lineup ── */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 pt-16 pb-24">
          <div className="mb-12 flex items-end justify-between gap-6">
            <p className="text-[10px] font-medium tracking-[0.22em] text-neutral-400 uppercase">Lineup</p>
            <Link
              to="/marketplace"
              className="text-sm font-normal text-neutral-500 transition-colors duration-200 hover:text-neutral-900"
            >
              Ver usados →
            </Link>
          </div>

          <div ref={lineupAnchorRef}>
            <div className="mb-10 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
              <h3 className="max-w-xl text-4xl font-semibold leading-[1.12] tracking-[-0.03em] text-neutral-900 sm:text-5xl">
                Productos destacados
              </h3>
              <Link
                to="/comparativa"
                className="shrink-0 text-sm font-normal text-neutral-500 transition-colors duration-200 hover:text-neutral-900"
              >
                Comparar todos los modelos ›
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FAMILY_LINEUP.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-80px' }}
                  variants={fadeUp}
                  custom={i * 0.1}
                  className="flex flex-col items-center text-center"
                >
                  <div
                    className={`group relative w-full overflow-hidden rounded-[2rem] shadow-[0_12px_48px_-20px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.03] ${item.imageBackdrop}`}
                  >
                    <div className="relative flex h-[230px] w-full items-center justify-center sm:h-[260px] md:h-[290px]">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="max-h-full w-auto max-w-[min(100%,260px)] object-contain object-center mix-blend-multiply p-4 transition-transform duration-500 group-hover:scale-105 sm:max-w-[280px]"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex justify-center gap-2.5 sm:mt-4" aria-hidden>
                    {item.swatches.map((sw, j) => (
                      <span key={`${item.id}-sw-${j}`} className={`h-2.5 w-2.5 rounded-full ring-1 ring-black/[0.08] ${sw}`} />
                    ))}
                  </div>

                  {item.isNew ? <p className="mt-3 text-[11px] font-semibold tracking-[0.02em] text-[#f56300]">Nuevo</p> : null}

                  <h4 className={`max-w-[18rem] text-[1.5rem] font-semibold leading-tight tracking-[-0.025em] text-neutral-900 sm:text-[1.7rem] ${item.isNew ? 'mt-1.5' : 'mt-4'}`}>
                    {item.title}
                  </h4>

                  <p className="mx-auto mt-3 max-w-[22rem] text-[16px] leading-snug text-neutral-600">{item.line1}</p>
                  <p className="mx-auto mt-1 max-w-[22rem] text-[16px] leading-snug text-neutral-600">{item.line2}</p>
                  <p className="mx-auto mt-3 max-w-[24rem] text-sm leading-relaxed text-neutral-700">{item.price}</p>

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
                    <Link
                      to="/marketplace"
                      className="inline-flex min-h-[2.75rem] min-w-[9rem] items-center justify-center rounded-full bg-[#0071e3] px-7 text-[15px] font-normal text-white transition-colors hover:bg-[#0077ed] active:bg-[#006edb]"
                    >
                      Conocer más
                    </Link>
                    <Link
                      to="/tienda"
                      className="inline-flex items-center gap-0.5 text-[15px] font-normal text-[#0071e3] transition-colors hover:underline"
                    >
                      Comprar <span aria-hidden className="text-lg leading-none">›</span>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Por qué Fix It ── */}
      <section className="border-t border-neutral-200/60 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            custom={0}
            className="mb-8 sm:mb-10"
          >
            <p className="mb-1.5 text-[10px] font-medium tracking-[0.22em] text-neutral-400 uppercase">Por qué Fix It</p>
            <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.03em] text-neutral-900 sm:text-4xl">
              Tecnología con respaldo.
            </h2>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                custom={i * 0.08}
                className="rounded-2xl bg-neutral-50 p-6 transition-colors duration-200 hover:bg-neutral-100/70"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] text-neutral-600">
                  {f.icon}
                </div>
                <h3 className="mb-2 text-sm font-semibold tracking-[-0.02em] text-neutral-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-500">{f.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={fadeUp}
            custom={0.1}
            className="mt-8 border-t border-neutral-200/80 pt-8 text-center"
          >
            <p className="mx-auto mb-4 max-w-md text-[15px] leading-relaxed text-neutral-600">
              Encontrá tu próximo equipo o repará el que ya tenés.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/marketplace"
                className="rounded-full bg-neutral-900 px-7 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
              >
                Ver usados
              </Link>
              <Link
                to="/reparaciones"
                className="rounded-full border border-neutral-200 bg-white px-7 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
              >
                Reparaciones
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Trade-in CTA ── */}
      <section className="mx-auto max-w-6xl px-6 pt-8 pb-14 sm:pt-10 sm:pb-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={fadeUp}
          custom={0}
          className="rounded-3xl bg-gray-900 px-8 py-10 text-center sm:px-10 sm:py-12"
        >
          <span className="mb-4 inline-block rounded-full border border-gray-700 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
            Plan canje · Marketplace
          </span>
          <h2 className="mb-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Tu iPhone vale: canjeá al renovar o vendé con Fix It
          </h2>
          <p className="mx-auto mb-6 max-w-lg text-base leading-relaxed text-gray-400">
            Aplicá el crédito del plan canje cuando compres tu próximo equipo. Si preferís vender, publicá tu iPhone en el
            marketplace y llegá a compradores con la confianza de una tienda verificada.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/publicar"
              className="rounded-full bg-white px-8 py-3 text-sm font-medium text-gray-900 transition-colors duration-150 hover:bg-gray-100"
            >
              Publicar mi iPhone
            </Link>
            <Link
              to="/marketplace"
              className="rounded-full border border-gray-700 px-8 py-3 text-sm font-medium text-gray-300 transition-colors duration-150 hover:border-gray-500 hover:text-white"
            >
              Ver usados y canje
            </Link>
          </div>
        </motion.div>
      </section>
    </>
  )
}
