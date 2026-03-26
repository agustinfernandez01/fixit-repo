import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getAccessToken } from '../../lib/auth'
import { marketplaceApi, uploadMarketplaceFoto } from '../../services/marketplaceApi'

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
      <section className="mx-auto max-w-2xl px-6 py-10">
        <p className="mb-1 text-[11px] font-semibold tracking-widest text-gray-300 uppercase">
          Marketplace
        </p>
        <h1 className="text-3xl font-black tracking-tight text-gray-900">
          Publicá tu celular
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-400">
          Completá los datos y subí fotos. El equipo Fix It revisará tu publicación; cuando
          esté aprobada, aparecerá en el{' '}
          <Link to="/marketplace" className="text-gray-900 underline">
            marketplace
          </Link>
          . La publicación se asocia a tu cuenta al iniciar sesión.
        </p>

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

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Fotos del equipo
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => setFiles(e.target.files)}
              className="w-full text-sm text-gray-500 file:mr-3 file:rounded-full file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
            />
            <p className="mt-1 text-xs text-gray-400">
              JPG, PNG o WebP. Máx. 5 MB por imagen.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-500">Título</label>
              <input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                placeholder="Ej. iPhone 14 impecable"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Modelo</label>
              <input
                value={form.modelo}
                onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Precio</label>
              <input
                value={form.precio_publicado}
                onChange={(e) =>
                  setForm((f) => ({ ...f, precio_publicado: e.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                inputMode="decimal"
                placeholder="0"
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
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Color</label>
              <input
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">IMEI</label>
              <input
                value={form.imei}
                onChange={(e) => setForm((f) => ({ ...f, imei: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>
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
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
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
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
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
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Descripción
            </label>
            <textarea
              value={form.descripcion}
              onChange={(e) =>
                setForm((f) => ({ ...f, descripcion: e.target.value }))
              }
              rows={4}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-gray-900 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-60 sm:w-auto sm:px-10"
          >
            {submitting ? 'Enviando…' : 'Enviar a revisión'}
          </button>
        </form>
      </section>
    </div>
  )
}
