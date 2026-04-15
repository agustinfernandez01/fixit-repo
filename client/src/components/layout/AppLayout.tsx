import { Link, Outlet } from 'react-router-dom'
import '../../styles/app.css'
import fixitLogo from '../../assets/fixit-logo.png'

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-logo" aria-label="Fix It inicio">
          <img className="app-logo-img" src={fixitLogo} alt="" aria-hidden />
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
