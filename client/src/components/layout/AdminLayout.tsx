import { Link, Outlet } from 'react-router-dom'

export function AdminLayout() {
  return (
    <div className="admin-layout">
      <div className="admin-toolbar">
        <Link to="/admin" className="admin-toolbar-title">
          Administración
        </Link>
        <span className="admin-toolbar-sep" aria-hidden>
          /
        </span>
        <Link to="/admin/inventario/modelos" className="admin-toolbar-crumb">
          Inventario
        </Link>
      </div>
      <Outlet />
    </div>
  )
}
