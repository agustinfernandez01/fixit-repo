import { Link, Outlet } from 'react-router-dom'

export default function AdminLayout() {
	return (
		<div style={{ minHeight: '100svh', display: 'grid', gridTemplateRows: '64px 1fr' }}>
			<header
				style={{
					borderBottom: '1px solid var(--border)',
					padding: '0 24px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
				}}
			>
				<strong>Panel Admin</strong>
				<Link to="/" style={{ textDecoration: 'none', color: 'var(--text-h)' }}>
					Volver al sitio
				</Link>
			</header>

			<main style={{ padding: '24px' }}>
				<Outlet />
			</main>
		</div>
	)
}
