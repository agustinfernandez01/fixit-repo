import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { getAccessToken } from '../../lib/auth'
import { usuarioApi } from '../../services/usuarioApi'
import type { UsuarioPerfil } from '../../types/usuario'

export default function PerfilPage() {
  const token = getAccessToken()
  const [perfil, setPerfil] = useState<UsuarioPerfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  if (!token) {
    return <Navigate to="/login?next=%2Fperfil" replace />
  }

  useEffect(() => {
    let mounted = true
    async function loadProfile() {
      setLoading(true)
      setError(null)
      try {
        const me = await usuarioApi.me()
        if (!mounted) return
        setPerfil(me)
      } catch (e) {
        if (!mounted) return
        setError(e instanceof Error ? e.message : 'No se pudo cargar tu perfil.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void loadProfile()
    return () => {
      mounted = false
    }
  }, [])

  const isAdmin = (perfil?.rol_nombre ?? '').toLowerCase().includes('admin')

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-gray-300 uppercase">Fix It</p>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Mi perfil</h1>
        </div>
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-900">
          Volver al inicio
        </Link>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-gray-100 bg-white p-8 text-gray-500">Cargando perfil...</div>
      ) : error ? (
        <div className="rounded-3xl border border-red-100 bg-red-50 p-8 text-red-700">{error}</div>
      ) : perfil ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-gray-400 uppercase">Datos de cuenta</p>
            <h2 className="mb-6 text-2xl font-black tracking-tight text-gray-900">
              {perfil.nombre ?? 'Usuario'} {perfil.apellido ?? ''}
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold tracking-widest text-gray-300 uppercase">Email</dt>
                <dd className="mt-1 text-sm text-gray-700">{perfil.email ?? 'No disponible'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-widest text-gray-300 uppercase">Teléfono</dt>
                <dd className="mt-1 text-sm text-gray-700">{perfil.telefono ?? 'No disponible'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-widest text-gray-300 uppercase">Estado</dt>
                <dd className="mt-1 text-sm text-gray-700">{perfil.activo ? 'Activo' : 'Inactivo'}</dd>
              </div>
            </dl>
          </article>

          <aside className="rounded-3xl border border-gray-200 bg-gray-900 p-8 text-white shadow-sm">
            <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-white/50 uppercase">Acceso</p>
            <h3 className="text-xl font-bold">Tu tipo de usuario</h3>
            {isAdmin ? (
              <p className="mt-4 text-sm text-white/80">
                Sos <span className="font-semibold">{perfil.rol_nombre}</span>. Tenés acceso al panel de administración.
              </p>
            ) : (
              <p className="mt-4 text-sm text-white/80">
                Tu cuenta está habilitada para operar como cliente.
              </p>
            )}

            {isAdmin ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold tracking-widest text-white/50 uppercase">Tipo</p>
                <p className="mt-1 text-lg font-bold">{perfil.rol_nombre}</p>
              </div>
            ) : null}

            <Link
              to={isAdmin ? '/admin' : '/tienda'}
              className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100"
            >
              {isAdmin ? 'Ir al panel' : 'Ir a tienda'}
            </Link>
          </aside>
        </div>
      ) : (
        <div className="rounded-3xl border border-gray-100 bg-white p-8 text-gray-500">No se pudo leer el perfil.</div>
      )}
    </section>
  )
}