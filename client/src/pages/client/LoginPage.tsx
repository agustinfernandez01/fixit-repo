import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiUrl } from '../../services/api'
import { setAuthTokens } from '../../lib/auth'
import { setCartToken } from '../../lib/cart'
import { carritoApi } from '../../services/carritoApi'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/publicar'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/login/post'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const text = await res.text()
      if (!res.ok) {
        let detail = res.statusText
        try {
          const j = JSON.parse(text) as { detail?: string }
          if (typeof j.detail === 'string') detail = j.detail
        } catch {
          if (text) detail = text
        }
        throw new Error(detail || `HTTP ${res.status}`)
      }
      const j = JSON.parse(text) as {
        access_token: string
        refresh_token: string
      }
      setAuthTokens(j.access_token, j.refresh_token)

      // Sincroniza el carrito con el usuario logueado y actualiza token local.
      const ensured = await carritoApi.ensure(true)
      if (ensured.token_identificador) {
        setCartToken(ensured.token_identificador)
      }

      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-md px-6 py-10">
        <p className="mb-1 text-[11px] font-semibold tracking-widest text-gray-300 uppercase">
          Fix It
        </p>
        <h1 className="text-2xl font-black tracking-tight text-gray-900">
          Iniciar sesión
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Usá la misma cuenta para publicar en el marketplace.
        </p>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Contraseña</label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-gray-900 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-60"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          <Link to="/" className="text-gray-900 underline">
            Volver al inicio
          </Link>
        </p>
      </section>
    </div>
  )
}
