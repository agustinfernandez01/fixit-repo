import { Link } from 'react-router-dom'

function IconInventario() {
  return (
    <svg className="admin-module-icon-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="8" y="10" width="32" height="28" rx="4" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 18h32" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="24" cy="29" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 14h4M30 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconMarketplace() {
  return (
    <svg className="admin-module-icon-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M14 14h20l-2 22H16L14 14z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M18 14l2-6h8l2 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M20 24h8M20 28h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function AdminHomePage() {
  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard-hero">
        <span className="admin-dashboard-badge">Panel interno</span>
        <h1 className="admin-dashboard-title">Centro de operaciones</h1>
        <p className="admin-dashboard-lead">
          Inventario, marketplace de usados y más. Elegí un módulo para continuar.
        </p>
      </header>

      <section className="admin-dashboard-section" aria-labelledby="admin-modules-heading">
        <h2 id="admin-modules-heading" className="admin-dashboard-section-title">
          Módulos
        </h2>
        <ul className="admin-dashboard-grid">
          <li>
            <Link to="/admin/inventario/modelos" className="admin-module-card">
              <span className="admin-module-icon-wrap">
                <IconInventario />
              </span>
              <div className="admin-module-body">
                <span className="admin-module-name">Inventario</span>
                <span className="admin-module-desc">
                  Modelos de equipo, unidades, depósitos, ubicaciones y condición de
                  usados.
                </span>
              </div>
              <span className="admin-module-arrow" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          </li>
          <li>
            <Link to="/admin/marketplace/publicaciones" className="admin-module-card">
              <span className="admin-module-icon-wrap">
                <IconMarketplace />
              </span>
              <div className="admin-module-body">
                <span className="admin-module-name">Marketplace</span>
                <span className="admin-module-desc">
                  Publicaciones de usados y revisiones de moderación.
                </span>
              </div>
              <span className="admin-module-arrow" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          </li>
        </ul>
      </section>

      <footer className="admin-dashboard-footer">
        <Link to="/" className="admin-dashboard-footer-link">
          ← Ir al sitio público
        </Link>
      </footer>
    </div>
  )
}
