import { Link, Outlet } from 'react-router-dom'

export default function AdminLayout() {
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <Link to="/admin" className="admin-brand">
            <span className="admin-brand-mark" aria-hidden>
              <span />
              <span />
              <span />
              <span />
            </span>
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
      </header>

      <main className="admin-main">
        <div className="admin-main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
