import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/admin/inventario/modelos', label: 'Modelos' },
  { to: '/admin/inventario/equipos', label: 'Equipos' },
  { to: '/admin/inventario/depositos', label: 'Depósitos' },
  { to: '/admin/inventario/ubicaciones', label: 'Ubicaciones' },
  { to: '/admin/inventario/equipos-usados', label: 'Equipos usados' },
] as const

export function InventarioLayout() {
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
