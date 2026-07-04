import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../../services/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [mensaje, setMensaje] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await forgotPassword(email.trim())
      setMensaje(res.message)
      setEnviado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la solicitud')
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
          Recuperar contraseña
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Ingresá tu email y te enviaremos un enlace para restablecerla.
        </p>

        {enviado ? (
          <div className="mt-8 rounded-2xl border border-green-100 bg-green-50 px-4 py-4 text-sm text-green-800">
            {mensaje}
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
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-gray-900 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-60"
              >
                {loading ? 'Enviando…' : 'Enviar enlace'}
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
