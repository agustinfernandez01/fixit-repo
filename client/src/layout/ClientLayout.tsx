import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
	CART_CHANGED_EVENT,
	type CartChangedDetail,
	regenerateCartToken,
	setCartToken,
} from '../lib/cart'
import { clearAuthTokens, getAccessToken, getCurrentUserRole } from '../lib/auth'
import { carritoApi } from '../services/carritoApi'

const NAV_LINKS = [
	{ to: '/', label: 'Inicio' },
	{ to: '/tienda', label: 'Tienda' },
	{ to: '/marketplace', label: 'Usados' },
	{ to: '/reparaciones', label: 'Reparaciones' },
	{ to: '/publicar', label: 'Vender' },
]

export default function ClientLayout() {
	const location = useLocation()
	const navigate = useNavigate()
	const logged = !!getAccessToken()
	const role = (getCurrentUserRole() ?? '').toLowerCase()
	const isAdmin = role.includes('admin')
	const [cartCount, setCartCount] = useState(0)
	const [cartReady, setCartReady] = useState(false)

	function handleLogout() {
		clearAuthTokens()
		navigate('/', { replace: true })
	}

	useEffect(() => {
		let alive = true
		let initialized = false
		let recoveredToken = false
		async function loadCart() {
			try {
				if (!initialized) {
					const ensured = await carritoApi.ensure(logged)
					if (ensured.token_identificador) {
						setCartToken(ensured.token_identificador)
					}
					initialized = true
				}
				const summary = await carritoApi.summary(logged)
				if (!alive) return
				setCartCount(summary.total_unidades)
				setCartReady(true)
			} catch (e) {
				const msg = e instanceof Error ? e.message.toLowerCase() : ''
				if (!recoveredToken && msg.includes('otro usuario')) {
					recoveredToken = true
					regenerateCartToken()
					initialized = false
					void loadCart()
					return
				}
				if (!alive) return
				setCartCount(0)
				setCartReady(true)
			}
		}

		void loadCart()
		const onChanged = (ev: Event) => {
			const detail = (ev as CustomEvent<CartChangedDetail>).detail
			if (detail?.totalUnidades !== undefined) {
				setCartCount(detail.totalUnidades)
				setCartReady(true)
				return
			}
			void loadCart()
		}
		window.addEventListener(CART_CHANGED_EVENT, onChanged)
		return () => {
			alive = false
			window.removeEventListener(CART_CHANGED_EVENT, onChanged)
		}
	}, [logged])

	return (
		<div className="min-h-screen bg-white font-sans text-gray-900">
			<header className="fixed top-0 right-0 left-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-md">
				<nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
					<Link to="/" className="flex items-center gap-2">
						<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900">
							<svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
								<circle cx="12" cy="12" r="4" />
								<circle cx="5" cy="5" r="2.5" />
								<circle cx="19" cy="5" r="2.5" />
								<circle cx="5" cy="19" r="2.5" />
								<circle cx="19" cy="19" r="2.5" />
							</svg>
						</div>
						<span className="text-sm font-semibold tracking-tight text-gray-900">Fix It</span>
					</Link>

					<ul className="hidden items-center gap-7 md:flex">
						{NAV_LINKS.map(({ to, label }) => (
							<li key={to}>
								<Link
									to={to}
									className="text-sm text-gray-400 transition-colors duration-150 hover:text-gray-900"
								>
									{label}
								</Link>
							</li>
						))}
					</ul>

					<div className="flex items-center gap-3">
						{logged ? (
							<Link
								to="/perfil"
								className="hidden text-sm text-gray-400 transition-colors duration-150 hover:text-gray-900 sm:block"
							>
								Perfil
							</Link>
						) : null}
						{logged && isAdmin ? (
							<Link
								to="/admin"
								className="hidden text-sm text-gray-400 transition-colors duration-150 hover:text-gray-900 sm:block"
							>
								Administración
							</Link>
						) : null}
						{logged ? (
							<button
								type="button"
								onClick={handleLogout}
								className="hidden text-sm text-gray-400 transition-colors duration-150 hover:text-gray-900 sm:block"
							>
								Salir
							</button>
						) : (
							<Link
								to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
								className="hidden text-sm text-gray-400 transition-colors duration-150 hover:text-gray-900 sm:block"
							>
								Ingresar
							</Link>
						)}
						<Link
							to="/carrito"
							className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition-colors duration-150 hover:border-gray-400 hover:text-gray-900"
							aria-label="Ver carrito"
						>
							<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M2.25 3h1.386a1.125 1.125 0 011.086.852l.364 1.455M7.5 14.25h9.75a2.25 2.25 0 002.25-2.25V8.25A2.25 2.25 0 0017.25 6H5.031" />
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M6.75 6l.75 3.75m0 0L8.25 14.25h9.75" />
								<circle cx="9.5" cy="19" r="1.5" />
								<circle cx="17.5" cy="19" r="1.5" />
							</svg>
							{cartReady && cartCount > 0 ? (
								<span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-gray-900 px-1 text-[10px] font-semibold text-white">
									{cartCount}
								</span>
							) : null}
						</Link>
						<button className="text-gray-400 hover:text-gray-900 md:hidden">
							<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
							</svg>
						</button>
					</div>
				</nav>
			</header>

			<main className="pt-14">
				<Outlet />
			</main>

			<footer className="mt-24 border-t border-gray-100">
				<div className="mx-auto max-w-6xl px-6 py-14">
					<div className="mb-10 grid grid-cols-2 gap-10 md:grid-cols-4">
						{[
							{ title: 'Products', links: ['Smartphones', 'Tablets', 'Accessories', 'Wearables'] },
							{ title: 'Company', links: ['About', 'Careers', 'Press', 'Blog'] },
							{ title: 'Support', links: ['Help Center', 'Contact', 'Warranty', 'Repairs'] },
							{ title: 'Legal', links: ['Privacy', 'Terms', 'Cookies', 'Licenses'] },
						].map((col) => (
							<div key={col.title}>
								<p className="mb-4 text-xs font-semibold tracking-widest text-gray-300 uppercase">{col.title}</p>
								<ul className="space-y-2.5">
									{col.links.map((link) => (
										<li key={link}>
											<a
												href="#"
												className="text-sm text-gray-400 transition-colors duration-150 hover:text-gray-900"
											>
												{link}
											</a>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>

					<div className="flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-8 sm:flex-row">
						<span className="text-xs text-gray-300">© 2026 Nexus Technologies. All rights reserved.</span>
						<div className="flex gap-5">
							{['Twitter', 'Instagram', 'YouTube'].map((social) => (
								<a
									key={social}
									href="#"
									className="text-xs text-gray-300 transition-colors duration-150 hover:text-gray-600"
								>
									{social}
								</a>
							))}
						</div>
					</div>
				</div>
			</footer>
		</div>
	)
}
