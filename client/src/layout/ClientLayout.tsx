import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { MotionConfig, motion } from 'framer-motion'
import {
	CART_CHANGED_EVENT,
	type CartChangedDetail,
	setLastKnownCartCount,
	regenerateCartToken,
	setCartToken,
} from '../lib/cart'
import fixitLogo from '../assets/fixit-logo.png'
import {
	AUTH_REFRESH_STATE_EVENT,
	AUTH_UPDATED_EVENT,
	clearAuthTokens,
	getAccessToken,
	getCurrentUserRole,
	isAuthRefreshInProgress,
} from '../lib/auth'
import { carritoApi } from '../services/carritoApi'

const NAV_LINKS = [
	{ to: '/', label: 'Inicio' },
	{ to: '/tienda', label: 'Tienda' },
	{ to: '/usados', label: 'Usados' },
	{ to: '/marketplace', label: 'Marketplace' },
	{ to: '/canje', label: 'Canje' },
	{ to: '/reparaciones', label: 'Reparaciones' },
	{ to: '/publicar', label: 'Vender' },
]

export default function ClientLayout() {
	const location = useLocation()
	const navigate = useNavigate()
	const forceShowAdminLink =
		(String(import.meta.env.VITE_SHOW_ADMIN_LINK ?? '') || '').trim().toLowerCase() in
		{ '1': true, true: true, yes: true, y: true, on: true }
	const [authSnapshot, setAuthSnapshot] = useState({
		logged: !!getAccessToken(),
		role: (getCurrentUserRole() ?? '').toLowerCase(),
	})
	const [isRefreshingAuth, setIsRefreshingAuth] = useState(isAuthRefreshInProgress())
	const logged = authSnapshot.logged
	const role = authSnapshot.role
	const isAdmin = role.includes('admin')
	const showAdminLink = forceShowAdminLink || (logged && isAdmin && !isRefreshingAuth)
	const [cartCount, setCartCount] = useState(0)
	const [cartReady, setCartReady] = useState(false)
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

	function handleLogout() {
		clearAuthTokens()
		setMobileMenuOpen(false)
		navigate('/', { replace: true })
	}

	useEffect(() => {
		setMobileMenuOpen(false)
	}, [location.pathname, location.search])

	useEffect(() => {
		const refreshSnapshot = () =>
			setAuthSnapshot({
				logged: !!getAccessToken(),
				role: (getCurrentUserRole() ?? '').toLowerCase(),
			})

		const onAuthUpdated = () => {
			refreshSnapshot()
		}
		const onRefreshState = (ev: Event) => {
			const detail = (ev as CustomEvent<{ inProgress?: boolean }>).detail
			if (typeof detail?.inProgress === 'boolean') {
				setIsRefreshingAuth(detail.inProgress)
			}
			if (!detail?.inProgress) {
				refreshSnapshot()
			}
		}

		window.addEventListener(AUTH_UPDATED_EVENT, onAuthUpdated)
		window.addEventListener(AUTH_REFRESH_STATE_EVENT, onRefreshState)
		return () => {
			window.removeEventListener(AUTH_UPDATED_EVENT, onAuthUpdated)
			window.removeEventListener(AUTH_REFRESH_STATE_EVENT, onRefreshState)
		}
	}, [])

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
				setLastKnownCartCount(summary.total_unidades)
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
				setLastKnownCartCount(detail.totalUnidades)
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
		<MotionConfig reducedMotion="user">
		<div className="min-h-screen bg-white font-sans text-gray-900">
			<header className="fixed top-0 right-0 left-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-md">
				<nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
					<Link to="/" className="flex items-center">
						<img src={fixitLogo} alt="Fix It" className="h-10 w-auto object-contain" />
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
						{isRefreshingAuth ? (
							<span className="hidden text-xs font-medium text-gray-400 sm:block">
								Actualizando sesión...
							</span>
						) : null}
						{logged ? (
							<Link
								to="/perfil"
								className="hidden text-sm text-gray-400 transition-colors duration-150 hover:text-gray-900 sm:block"
							>
								Perfil
							</Link>
						) : null}
						{showAdminLink ? (
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
						<motion.div whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.97 }}>
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
						</motion.div>
						<button
							type="button"
							onClick={() => setMobileMenuOpen((prev) => !prev)}
							aria-label="Abrir menú"
							aria-expanded={mobileMenuOpen}
							aria-controls="mobile-nav-menu"
							className="text-gray-400 hover:text-gray-900 md:hidden"
						>
							<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
							</svg>
						</button>
					</div>
				</nav>
				{mobileMenuOpen ? (
					<div id="mobile-nav-menu" className="border-t border-gray-100 bg-white px-6 py-4 md:hidden">
						<ul className="space-y-3">
							{NAV_LINKS.map(({ to, label }) => (
								<li key={`mobile-${to}`}>
									<Link
										to={to}
										className="block text-sm text-gray-600 transition-colors duration-150 hover:text-gray-900"
									>
										{label}
									</Link>
								</li>
							))}
							<li>
								<Link
									to="/carrito"
									className="block text-sm text-gray-600 transition-colors duration-150 hover:text-gray-900"
								>
									Carrito
								</Link>
							</li>
							{showAdminLink ? (
								<li>
									<Link
										to="/admin"
										className="block text-sm text-gray-600 transition-colors duration-150 hover:text-gray-900"
									>
										Administración
									</Link>
								</li>
							) : null}
							{logged ? (
								<>
									<li>
										<Link
											to="/perfil"
											className="block text-sm text-gray-600 transition-colors duration-150 hover:text-gray-900"
										>
											Perfil
										</Link>
									</li>
									<li>
										<button
											type="button"
											onClick={handleLogout}
											className="block text-sm text-gray-600 transition-colors duration-150 hover:text-gray-900"
										>
											Salir
										</button>
									</li>
								</>
							) : (
								<li>
									<Link
										to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
										className="block text-sm text-gray-600 transition-colors duration-150 hover:text-gray-900"
									>
										Ingresar
									</Link>
								</li>
							)}
						</ul>
					</div>
				) : null}
			</header>

			<main className="pt-16">
				<div className="overflow-x-hidden">
					<motion.div
						key={location.pathname}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.2, ease: 'easeOut' }}
					>
						<Outlet />
					</motion.div>
				</div>
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

		{/* Botón flotante de WhatsApp */}
		<a
			href="https://wa.me/543816226300"
			target="_blank"
			rel="noreferrer"
			aria-label="Contactar por WhatsApp"
			className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-lg transition-all duration-200 hover:bg-[#1ebe5d] hover:shadow-xl active:scale-95 sm:bottom-6 sm:right-6"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="currentColor"
				className="h-5 w-5 shrink-0"
			>
				<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
				<path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.554 4.103 1.523 5.83L.057 23.25a.75.75 0 00.918.919l5.42-1.466A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.71 9.71 0 01-4.946-1.355l-.355-.211-3.673.993.993-3.674-.211-.355A9.71 9.71 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
			</svg>
			<span className="hidden text-sm font-medium sm:block">¿Consultas?</span>
		</a>
		</MotionConfig>
	)
}
