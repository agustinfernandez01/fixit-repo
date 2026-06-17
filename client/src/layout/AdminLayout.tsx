import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import fixitLogo from '../assets/fixit-logo.png'
import { getAccessToken, getCurrentUserRole } from '../lib/auth'

const SEGMENT_LABELS: Record<string, string> = {
  admin:          'Panel',
  pedidos:        'Pedidos',
  'solicitudes-canje': 'Canjes',
  inventario:     'Inventario',
  modelos:        'Modelos',
  equipos:        'Equipos',
  accesorios:     'Accesorios',
  canje:          'Canje',
  depositos:      'Depósitos',
  ubicaciones:    'Ubicaciones',
  'equipos-usados': 'Equipos usados',
  marketplace:    'Marketplace',
  publicaciones:  'Publicaciones',
  revisiones:     'Revisiones',
  intereses:      'Intereses',
}

function AdminBreadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length <= 1) return null

  const crumbs = segments.map((seg, i) => ({
    label: SEGMENT_LABELS[seg] ?? seg,
    to: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }))

  return (
    <nav className="admin-breadcrumb" aria-label="Breadcrumb">
      <div className="admin-breadcrumb-inner">
        {crumbs.map((crumb, i) => (
          <span key={crumb.to} className="admin-breadcrumb-item">
            {i > 0 && <span className="admin-breadcrumb-sep" aria-hidden>›</span>}
            {crumb.isLast ? (
              <span className="admin-breadcrumb-current">{crumb.label}</span>
            ) : (
              <Link to={crumb.to} className="admin-breadcrumb-link">{crumb.label}</Link>
            )}
          </span>
        ))}
      </div>
    </nav>
  )
}

export default function AdminLayout() {
  const location = useLocation()
  const token = getAccessToken()
  const role = (getCurrentUserRole() ?? '').toLowerCase()
  const isAdmin = role.includes('admin')
  const bypass = import.meta.env.DEV || String(import.meta.env.VITE_ADMIN_BYPASS ?? '').toLowerCase() === 'true'

  if (!token && !bypass) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  if (!isAdmin && !bypass) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <Link to="/admin" className="admin-brand">
            <img className="admin-brand-img" src={fixitLogo} alt="" aria-hidden />
            <span className="admin-brand-text">
              <span className="admin-brand-title">Fix It</span>
              <span className="admin-brand-sub">Administración</span>
            </span>
          </Link>
          <Link to="/" className="admin-header-exit">
            <span className="admin-header-exit-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <path d="M16 17l5-5-5-5M21 12H9" />
              </svg>
            </span>
            Volver al sitio
          </Link>
        </div>
        <AdminBreadcrumb pathname={location.pathname} />
      </header>

      <main className="admin-main">
        <div className="admin-main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
