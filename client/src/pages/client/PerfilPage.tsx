import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { getAccessToken } from '../../lib/auth'
import { usuarioApi } from '../../services/usuarioApi'
import type { UsuarioPerfil } from '../../types/usuario'

// ── Avatar con iniciales ──────────────────────────────────────────────────────
function Avatar({ nombre, apellido }: { nombre: string; apellido: string }) {
  const initials = `${nombre?.[0] ?? ''}${apellido?.[0] ?? ''}`.toUpperCase()
  return (
    <div
      style={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        background: '#111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', letterSpacing: '-0.02em' }}>
        {initials || '?'}
      </span>
    </div>
  )
}

// ── Fila de dato ──────────────────────────────────────────────────────────────
function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '1rem 0',
        borderBottom: '1px solid #f3f4f6',
      }}
    >
      <span style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em', color: '#9ca3af', textTransform: 'uppercase', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: '0.9rem', color: '#111', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonPerfil() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div style={{ marginBottom: '3rem' }}>
        <div className="skeleton" style={{ width: 120, height: 10, borderRadius: 99, marginBottom: '0.75rem' }} />
        <div className="skeleton" style={{ width: 240, height: 36, borderRadius: 8 }} />
      </div>
      <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div style={{ borderRadius: 20, border: '1px solid #f3f4f6', padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div className="skeleton" style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0 }} />
            <div>
              <div className="skeleton" style={{ width: 150, height: 20, borderRadius: 6, marginBottom: '0.5rem' }} />
              <div className="skeleton" style={{ width: 80, height: 14, borderRadius: 99 }} />
            </div>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ padding: '1rem 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
              <div className="skeleton" style={{ width: 60, height: 11, borderRadius: 99 }} />
              <div className="skeleton" style={{ width: 140, height: 14, borderRadius: 6 }} />
            </div>
          ))}
        </div>
        <div style={{ borderRadius: 20, border: '1px solid #f3f4f6', padding: '2rem' }}>
          <div className="skeleton" style={{ width: 100, height: 11, borderRadius: 99, marginBottom: '1rem' }} />
          <div className="skeleton" style={{ width: '80%', height: 24, borderRadius: 6, marginBottom: '0.5rem' }} />
          <div className="skeleton" style={{ width: '60%', height: 14, borderRadius: 6, marginTop: '1rem' }} />
          <div className="skeleton" style={{ width: '100%', height: 48, borderRadius: 99, marginTop: '2rem' }} />
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
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
    return () => { mounted = false }
  }, [])

  if (loading) return <SkeletonPerfil />

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p style={{ fontSize: '0.875rem', color: '#ef4444' }}>{error}</p>
      </div>
    )
  }

  if (!perfil) return null

  const isAdmin = perfil.rol_nombre.toLowerCase().includes('admin')
  const nombreCompleto = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ')

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">

      {/* ── Encabezado ── */}
      <header style={{ marginBottom: '3rem' }}>
        <p style={{ fontSize: '0.625rem', fontWeight: 500, letterSpacing: '0.22em', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
          Fix It · Perfil
        </p>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)', fontWeight: 600, letterSpacing: '-0.03em', color: '#111', lineHeight: 1.1 }}>
          {nombreCompleto || 'Mi perfil'}
        </h1>
      </header>

      {/* ── Grid de cards ── */}
      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>

        {/* Card izquierda: datos personales */}
        <article
          style={{
            borderRadius: 20,
            border: '1px solid #f0f0f0',
            background: '#fff',
            padding: '2rem',
          }}
        >
          {/* Avatar + nombre */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <Avatar nombre={perfil.nombre} apellido={perfil.apellido} />
            <div>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#111', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {nombreCompleto}
              </p>
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '0.35rem',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: perfil.activo ? '#059669' : '#9ca3af',
                  background: perfil.activo ? '#ecfdf5' : '#f9fafb',
                  borderRadius: 99,
                  padding: '2px 10px',
                }}
              >
                {perfil.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>

          {/* Datos */}
          <div style={{ marginTop: '-0.5rem' }}>
            <DataRow label="Email" value={perfil.email ?? '—'} />
            <DataRow label="Teléfono" value={perfil.telefono ?? '—'} />
            <DataRow label="ID de cuenta" value={`#${perfil.id_usuario}`} />
          </div>
        </article>

        {/* Card derecha: acceso + CTA */}
        <aside
          style={{
            borderRadius: 20,
            border: '1px solid #111',
            background: '#111',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <p style={{ fontSize: '0.625rem', fontWeight: 500, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Tipo de acceso
          </p>

          <p style={{ fontSize: '1.4rem', fontWeight: 600, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {isAdmin ? 'Administrador' : 'Cliente'}
          </p>

          <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, flexGrow: 1 }}>
            {isAdmin
              ? 'Tenés acceso completo al panel de administración para gestionar inventario, pedidos y usuarios.'
              : 'Tu cuenta está habilitada para comprar, canjes, reparaciones y venta de equipos.'}
          </p>

          {/* Rol badge */}
          <div
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Rol</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>{perfil.rol_nombre}</span>
          </div>

          {/* CTA */}
          <Link
            to={isAdmin ? '/admin' : '/tienda'}
            style={{
              marginTop: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              borderRadius: 99,
              background: '#fff',
              color: '#111',
              fontSize: '0.875rem',
              fontWeight: 600,
              padding: '0.85rem 1.5rem',
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            {isAdmin ? 'Ir al panel de admin' : 'Explorar tienda'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </aside>

      </div>
    </section>
  )
}
