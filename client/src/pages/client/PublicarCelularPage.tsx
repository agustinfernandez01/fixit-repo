import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getAccessToken } from '../../lib/auth'
import { marketplaceApi, uploadMarketplaceFoto } from '../../services/marketplaceApi'

function formatArsInput(value: string | number): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const n = Number.parseFloat(raw.replace(',', '.'))
  if (!Number.isFinite(n)) return raw
  return n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

const empty = {
  titulo: '',
  modelo: '',
  capacidad_gb: '' as string | number,
  color: '',
  imei: '',
  bateria_porcentaje: '' as string | number,
  estado_estetico: '',
  estado_funcional: '',
  descripcion: '',
  precio_publicado: '' as string | number,
}

export default function PublicarCelularPage() {
  const location = useLocation()
  const logged = !!getAccessToken()
  const [form, setForm] = useState(empty)
  const [files, setFiles] = useState<FileList | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneId, setDoneId] = useState<number | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDoneId(null)

    if (!getAccessToken()) {
      setError('Tenés que iniciar sesión para publicar. Podés hacerlo desde el menú superior.')
      return
    }

    setSubmitting(true)
    try {
      const urls: string[] = []
      if (files?.length) {
        for (const f of Array.from(files)) {
          const url = await uploadMarketplaceFoto(f)
          urls.push(url)
        }
      }

      const cap =
        form.capacidad_gb === '' ? null : Number(form.capacidad_gb)
      const bat =
        form.bateria_porcentaje === '' ? null : Number(form.bateria_porcentaje)
      const precioRaw = String(form.precio_publicado).trim().replace(',', '.')
      const precio =
        precioRaw === '' ? null : Number.parseFloat(precioRaw)

      const body: Record<string, unknown> = {
        titulo: form.titulo.trim() || null,
        modelo: form.modelo.trim() || null,
        capacidad_gb: cap != null && Number.isFinite(cap) ? cap : null,
        color: form.color.trim() || null,
        imei: form.imei.trim() || null,
        bateria_porcentaje: bat != null && Number.isFinite(bat) ? bat : null,
        estado_estetico: form.estado_estetico.trim() || null,
        estado_funcional: form.estado_funcional.trim() || null,
        descripcion: form.descripcion.trim() || null,
        precio_publicado:
          precio != null && Number.isFinite(precio) ? precio : null,
        fotos_urls: urls.length ? urls : null,
      }

      const created = await marketplaceApi.publicaciones.create(body, {
        withAuth: true,
      })
      setDoneId(created.id_publicacion)
      setForm(empty)
      setFiles(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_0.9fr] lg:items-start">
          <div>
            <div className="rounded-3xl border border-gray-100 bg-gradient-to-b from-gray-50 to-white px-6 py-8 sm:px-8">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor">
                    <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 3v14h10V5H7zm5 15.25a1.25 1.25 0 1 0 0 2.5a1.25 1.25 0 0 0 0-2.5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-widest text-gray-300 uppercase">
                    Marketplace
                  </p>
                  <h1 className="mt-1 text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">
                    Publicá tu celular
                  </h1>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-gray-500">
                Completá los datos y subí fotos. El equipo Fix It revisará tu publicación; cuando
                esté aprobada, aparecerá en el{' '}
                <Link to="/marketplace" className="text-gray-900 underline">
                  marketplace
                </Link>
                .
              </p>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                La publicación se asocia a tu cuenta al iniciar sesión.
              </p>
            </div>

            {!logged ? (
              <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Para publicar necesitás{' '}
                <Link
                  to={`/login?next=${encodeURIComponent(location.pathname)}`}
                  className="font-medium underline"
                >
                  iniciar sesión
                </Link>
                .
              </div>
            ) : null}

            {doneId != null ? (
              <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <strong>Listo.</strong> Tu aviso #{doneId} quedó en revisión. Te avisaremos o
                podés consultar el estado con el equipo Fix It.
              </div>
            ) : null}

            {error ? (
              <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-10 space-y-6">
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Fotos</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Subí fotos claras (frente, dorso y laterales). Máx. 5 MB por imagen.
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500">
                    Opcional
                  </span>
                </div>
                <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => setFiles(e.target.files)}
                    className="w-full text-sm text-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                  />
                  <p className="mt-2 text-xs text-gray-400">
                    Formatos: JPG, PNG o WebP.
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {files?.length ? `${files.length} archivo(s) seleccionados` : 'Ningún archivo seleccionado'}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-7">
                <h2 className="text-base font-semibold text-gray-900">Datos del equipo</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Esto ayuda a revisar más rápido y mejorar la confianza del comprador.
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-500">Título</label>
                    <input
                      value={form.titulo}
                      onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                      placeholder="Ej. iPhone 14 impecable"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Modelo</label>
                    <input
                      value={form.modelo}
                      onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                      placeholder="Ej. iPhone 14"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Capacidad (GB)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.capacidad_gb}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, capacidad_gb: e.target.value }))
                      }
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                      placeholder="Ej. 128"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Color</label>
                    <input
                      value={form.color}
                      onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                      placeholder="Ej. Negro"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">IMEI</label>
                    <input
                      value={form.imei}
                      onChange={(e) => setForm((f) => ({ ...f, imei: e.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-7">
                <h2 className="text-base font-semibold text-gray-900">Estado y precio</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Podés dejar campos vacíos si no estás seguro; el equipo Fix It lo revisa.
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Batería (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.bateria_porcentaje}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, bateria_porcentaje: e.target.value }))
                      }
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                      placeholder="Ej. 92"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Precio</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-medium text-gray-400">
                        $
                      </span>
                      <input
                        value={form.precio_publicado}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, precio_publicado: e.target.value }))
                        }
                        className="w-full rounded-2xl border border-gray-200 bg-white py-3 pr-4 pl-10 text-sm text-gray-900 outline-none focus:border-gray-400"
                        inputMode="decimal"
                        placeholder="0"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Sugerencia: {formatArsInput(form.precio_publicado) ? `$ ${formatArsInput(form.precio_publicado)}` : '—'}
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Estado estético
                    </label>
                    <input
                      value={form.estado_estetico}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, estado_estetico: e.target.value }))
                      }
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                      placeholder="Ej. 9/10, sin golpes"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Estado funcional
                    </label>
                    <input
                      value={form.estado_funcional}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, estado_funcional: e.target.value }))
                      }
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                      placeholder="Ej. Todo OK, FaceID OK"
                    />
                  </div>
                </div>

                <div className="mt-5">
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Descripción
                  </label>
                  <textarea
                    value={form.descripcion}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, descripcion: e.target.value }))
                    }
                    rows={5}
                    className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                    placeholder="Contá qué incluye (cargador, caja), detalles de uso, etc."
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-400">
                  Al enviar aceptás que el equipo Fix It revise y apruebe la publicación antes de
                  mostrarla.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-full bg-gray-900 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-60 sm:px-10"
                >
                  {submitting ? 'Enviando…' : 'Enviar a revisión'}
                </button>
              </div>
            </form>
          </div>

          <aside className="lg:sticky lg:top-20">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">Resumen</h2>
              <p className="mt-1 text-sm text-gray-500">
                Revisá antes de enviar.
              </p>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">Título</span>
                  <span className="max-w-[55%] truncate text-right text-gray-900">
                    {form.titulo.trim() || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">Modelo</span>
                  <span className="max-w-[55%] truncate text-right text-gray-900">
                    {form.modelo.trim() || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">Precio</span>
                  <span className="text-right text-gray-900">
                    {formatArsInput(form.precio_publicado) ? `$ ${formatArsInput(form.precio_publicado)}` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">Fotos</span>
                  <span className="text-right text-gray-900">
                    {files?.length ? `${files.length}` : '0'}
                  </span>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium text-gray-700">Tip</p>
                <p className="mt-1 text-xs text-gray-500">
                  Un título claro + 3 fotos buenas suele acelerar la aprobación.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
