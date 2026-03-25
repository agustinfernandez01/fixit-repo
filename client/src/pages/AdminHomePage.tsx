import { Link } from 'react-router-dom'

export function AdminHomePage() {
  return (
    <section className="admin-home">
      <h1>Panel de administración</h1>
      <p className="lead">
        Herramientas internas para operar Fix It. Elegí un módulo para
        continuar.
      </p>
      <ul className="admin-modules">
        <li>
          <Link to="/admin/inventario/modelos" className="admin-module-card">
            <span className="admin-module-name">Inventario</span>
            <span className="admin-module-desc">
              Modelos, equipos, depósitos, ubicaciones y detalle de usados.
            </span>
          </Link>
        </li>
      </ul>
      <p className="admin-back">
        <Link to="/">← Volver al inicio</Link>
      </p>
    </section>
  )
}
