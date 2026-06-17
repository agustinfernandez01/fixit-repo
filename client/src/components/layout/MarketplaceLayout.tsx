import { Link, NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/admin/marketplace/publicaciones', label: 'Publicaciones' },
] as const

export function MarketplaceLayout() {
  return (
    <div className="inv-layout">
      <aside className="inv-side">
        <Link to="/admin" className="inv-side-back">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M19 12H5M5 12l7 7M5 12l7-7" />
          </svg>
          Panel
        </Link>
        <hr className="inv-side-divider" />
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => (isActive ? 'active' : '')}
            end={false}
          >
            {label}
          </NavLink>
        ))}
      </aside>
      <div className="inv-content">
        <Outlet />
      </div>
    </div>
  )
}
