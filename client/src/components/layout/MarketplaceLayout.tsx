import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/admin/marketplace/publicaciones', label: 'Publicaciones' },
  { to: '/admin/marketplace/revisiones', label: 'Revisiones' },
] as const

export function MarketplaceLayout() {
  return (
    <div className="inv-layout">
      <aside className="inv-side">
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
