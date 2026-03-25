import { useState } from 'react'

const PHONES = [
  {
    id: 1,
    name: 'Nexus X Ultra',
    tag: 'Pro Series',
    price: '$1,199',
    badge: 'New',
    accent: 'bg-gray-900',
    accentText: 'text-white',
    specs: ['6.9″ AMOLED', '200 MP', '5,000 mAh', 'Snapdragon 8 Gen 4'],
  },
  {
    id: 2,
    name: 'Nexus Slim 15',
    tag: 'Design Series',
    price: '$899',
    badge: 'Trending',
    accent: 'bg-gray-100',
    accentText: 'text-gray-900',
    specs: ['6.4″ OLED', '108 MP', '4,200 mAh', 'Dimensity 9300'],
  },
  {
    id: 3,
    name: 'Nexus Core',
    tag: 'Essential',
    price: '$549',
    badge: 'Best Value',
    accent: 'bg-gray-100',
    accentText: 'text-gray-900',
    specs: ['6.1″ LCD', '64 MP', '4,000 mAh', 'Snapdragon 7s'],
  },
]

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
            <button className="rounded-full bg-gray-900 px-7 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-gray-700">
              Explore lineup
            </button>
            <button className="rounded-full border border-gray-200 px-7 py-3 text-sm font-medium text-gray-500 transition-colors duration-150 hover:border-gray-400 hover:text-gray-900">
              Compare models
            </button>
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

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-1.5 text-[11px] tracking-widest text-gray-300 uppercase">Lineup</p>
            <h2 className="text-3xl font-black tracking-tight text-gray-900">Choose your Nexus</h2>
          </div>
          <a href="#" className="text-sm text-gray-400 transition-colors duration-150 hover:text-gray-900">
            View all →
          </a>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {PHONES.map((phone) => (
            <div
              key={phone.id}
              className="group cursor-pointer overflow-hidden rounded-3xl border border-gray-100 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-gray-300 hover:shadow-sm"
            >
              <div className="bg-gray-50 py-10">
                <PhoneMockup dark={phone.id === 1} />
              </div>

              <div className="border-t border-gray-100 p-6">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] text-gray-400">{phone.tag}</p>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-gray-500 uppercase">
                    {phone.badge}
                  </span>
                </div>
                <h3 className="mb-1 text-base font-bold text-gray-900">{phone.name}</h3>
                <p className="mb-4 text-xl font-black text-gray-900">{phone.price}</p>

                <ul className="mb-5 grid grid-cols-2 gap-1.5">
                  {phone.specs.map((s) => (
                    <li key={s} className="rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-400">
                      {s}
                    </li>
                  ))}
                </ul>

                <button className="w-full rounded-2xl bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-gray-700">
                  Shop now
                </button>
              </div>
            </div>
          ))}
        </div>
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