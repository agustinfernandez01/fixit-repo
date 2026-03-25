import { Link, Outlet } from 'react-router-dom'
import '../../styles/app.css'

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-logo" aria-label="Fix It inicio">
          <span className="app-logo-mark" aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </span>
          Fix It
        </Link>
        <nav className="app-header-actions">
          <Link to="/admin">Administración</Link>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
