import { useEffect, useRef, useState } from 'react'
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

const NAV_MAIN = [
	{ to: '/tienda', label: 'Tienda' },
	{ to: '/usados', label: 'Usados' },
]

const NAV_SERVICIOS = [
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
	const [serviciosOpen, setServiciosOpen] = useState(false)
	const [mobileServiciosOpen, setMobileServiciosOpen] = useState(false)
	const serviciosRef = useRef<HTMLLIElement>(null)

	function handleLogout() {
		clearAuthTokens()
		setMobileMenuOpen(false)
		navigate('/', { replace: true })
	}

	useEffect(() => {
		setMobileMenuOpen(false)
		setServiciosOpen(false)
		setMobileServiciosOpen(false)
	}, [location.pathname, location.search])

	// Cerrar dropdown de Servicios al hacer click fuera
	useEffect(() => {
		if (!serviciosOpen) return
		function handleClickOutside(e: MouseEvent) {
			if (serviciosRef.current && !serviciosRef.current.contains(e.target as Node)) {
				setServiciosOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [serviciosOpen])

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
						{NAV_MAIN.map(({ to, label }) => (
							<li key={to}>
								<Link
									to={to}
									className="text-sm text-gray-400 transition-colors duration-150 hover:text-gray-900"
								>
									{label}
								</Link>
							</li>
						))}

						{/* Dropdown Servicios — desktop */}
						<li ref={serviciosRef} style={{ position: 'relative' }}>
							<button
								type="button"
								onClick={() => setServiciosOpen((v) => !v)}
								className="flex items-center gap-1 text-sm text-gray-400 transition-colors duration-150 hover:text-gray-900"
							>
								Servicios
								<svg
									style={{ transition: 'transform 0.18s', transform: serviciosOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
									width="12" height="12" viewBox="0 0 12 12" fill="none"
								>
									<path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
								</svg>
							</button>

							{serviciosOpen && (
								<div style={{
									position: 'absolute',
									top: 'calc(100% + 12px)',
									left: '50%',
									transform: 'translateX(-50%)',
									background: '#fff',
									border: '1px solid #f0f0f0',
									borderRadius: 12,
									boxShadow: '0 8px 24px rgba(0,0,0,0.09)',
									padding: '6px 0',
									minWidth: 160,
									zIndex: 100,
								}}>
									{NAV_SERVICIOS.map(({ to, label }) => (
										<Link
											key={to}
											to={to}
											style={{ display: 'block', padding: '9px 18px', fontSize: '0.875rem', color: '#6b7280', transition: 'color 0.15s', whiteSpace: 'nowrap' }}
											onMouseEnter={e => (e.currentTarget.style.color = '#111')}
											onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
										>
											{label}
										</Link>
									))}
								</div>
							)}
						</li>
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
							{NAV_MAIN.map(({ to, label }) => (
								<li key={`mobile-${to}`}>
									<Link
										to={to}
										className="block text-sm text-gray-600 transition-colors duration-150 hover:text-gray-900"
									>
										{label}
									</Link>
								</li>
							))}

							{/* Acordeón Servicios — mobile */}
							<li>
								<button
									type="button"
									onClick={() => setMobileServiciosOpen((v) => !v)}
									className="flex w-full items-center justify-between text-sm text-gray-600 transition-colors duration-150 hover:text-gray-900"
								>
									<span>Servicios</span>
									<svg
										style={{ transition: 'transform 0.18s', transform: mobileServiciosOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
										width="12" height="12" viewBox="0 0 12 12" fill="none"
									>
										<path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
									</svg>
								</button>
								{mobileServiciosOpen && (
									<ul className="mt-2 space-y-2 border-l-2 border-gray-100 pl-4">
										{NAV_SERVICIOS.map(({ to, label }) => (
											<li key={`mobile-srv-${to}`}>
												<Link
													to={to}
													className="block text-sm text-gray-400 transition-colors duration-150 hover:text-gray-900"
												>
													{label}
												</Link>
											</li>
										))}
									</ul>
								)}
							</li>

							<li className="border-t border-gray-100 pt-2">
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

					{/* ── Cuerpo del footer ── */}
					<div className="mb-12 grid gap-10 sm:grid-cols-2 md:grid-cols-3">

						{/* Marca */}
						<div>
							<Link to="/" className="inline-block mb-4">
								<img src={fixitLogo} alt="Fix It" className="h-8 w-auto object-contain" />
							</Link>
							<p className="text-sm text-gray-400 leading-relaxed max-w-xs">
								Tu tienda de tecnología Apple en Tucumán. Equipos nuevos, usados, reparaciones y canje.
							</p>
						</div>

						{/* Navegación */}
						<div>
							<p className="mb-4 text-[10px] font-semibold tracking-[0.18em] text-gray-300 uppercase">Navegación</p>
							<ul className="space-y-2.5">
								{[
									{ to: '/tienda',       label: 'Tienda' },
									{ to: '/usados',       label: 'Usados' },
									{ to: '/reparaciones', label: 'Reparaciones' },
									{ to: '/canje',        label: 'Canje' },
									{ to: '/publicar',     label: 'Vender' },
									{ to: '/comparativa',  label: 'Comparativa' },
								].map(({ to, label }) => (
									<li key={to}>
										<Link to={to} className="text-sm text-gray-400 transition-colors duration-150 hover:text-gray-900">
											{label}
										</Link>
									</li>
								))}
							</ul>
						</div>

						{/* Contacto y ubicación */}
						<div>
							<p className="mb-4 text-[10px] font-semibold tracking-[0.18em] text-gray-300 uppercase">Contacto</p>
							<ul className="space-y-4">
								{/* Ubicación */}
								<li className="flex items-start gap-2.5">
									<svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
									</svg>
									<span className="text-sm text-gray-400 leading-snug">
										Marcos Paz 389<br />
										<span className="text-gray-300">San Miguel de Tucumán</span>
									</span>
								</li>
								{/* WhatsApp */}
								<li className="flex items-center gap-2.5">
									<svg className="h-4 w-4 shrink-0 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
										<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
										<path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.554 4.103 1.523 5.83L.057 23.25a.75.75 0 00.918.919l5.42-1.466A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.71 9.71 0 01-4.946-1.355l-.355-.211-3.673.993.993-3.674-.211-.355A9.71 9.71 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
									</svg>
									<a
										href="https://wa.me/543816226300"
										target="_blank"
										rel="noreferrer"
										className="text-sm text-gray-400 transition-colors duration-150 hover:text-gray-900"
									>
										+54 381 622-6300
									</a>
								</li>
								{/* Instagram */}
								<li className="flex items-center gap-2.5">
									<svg className="h-4 w-4 shrink-0 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
										<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
									</svg>
									<a
										href="https://www.instagram.com/fixit_arg/"
										target="_blank"
										rel="noreferrer"
										className="text-sm text-gray-400 transition-colors duration-150 hover:text-gray-900"
									>
										@fixit_arg
									</a>
								</li>
							</ul>
						</div>
					</div>

					{/* ── Barra inferior ── */}
					<div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-8 sm:flex-row">
						<span className="text-xs text-gray-300">© {new Date().getFullYear()} Fix It. Todos los derechos reservados.</span>
						<a
							href="https://www.instagram.com/fixit_arg/"
							target="_blank"
							rel="noreferrer"
							className="flex items-center gap-1.5 text-xs text-gray-300 transition-colors duration-150 hover:text-gray-700"
						>
							<svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
							</svg>
							@fixit_arg
						</a>
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
