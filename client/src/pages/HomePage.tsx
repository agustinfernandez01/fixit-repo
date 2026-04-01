import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <section className="home-hero">
      <h1>Fix It</h1>
      <p>
        Panel de operaciones para el equipo. El inventario y otras herramientas
        internas están en administración.
      </p>
      <Link to="/admin" className="btn btn-primary">
        Ir al panel de administración
      </Link>
    </section>
  )
}
