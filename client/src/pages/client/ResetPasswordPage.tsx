import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../../services/api'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      await resetPassword(token, password)
      setOk(true)
      setTimeout(() => navigate('/login', { replace: true }), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña')
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
          Nueva contraseña
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Elegí una nueva contraseña para tu cuenta.
        </p>

        {!token ? (
          <div className="mt-8 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-800">
            El enlace no es válido. Solicitá uno nuevo desde{' '}
            <Link to="/recuperar" className="underline">
              recuperar contraseña
            </Link>
            .
          </div>
        ) : ok ? (
          <div className="mt-8 rounded-2xl border border-green-100 bg-green-50 px-4 py-4 text-sm text-green-800">
            Tu contraseña se actualizó correctamente. Redirigiendo al inicio de sesión…
          </div>
        ) : (
          <>
            {error ? (
              <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-gray-900 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-60"
              >
                {loading ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link to="/login" className="text-gray-900 underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </section>
    </div>
  )
}
