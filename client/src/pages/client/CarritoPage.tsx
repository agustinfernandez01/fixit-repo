import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAccessToken, setAuthTokens } from '../../lib/auth'
import {
  CART_CHANGED_EVENT,
  type CartChangedDetail,
  regenerateCartToken,
  setCartToken,
} from '../../lib/cart'
import { apiUrl } from '../../services/api'
import { carritoApi } from '../../services/carritoApi'
import type { CarritoCheckoutResponse, CarritoResumen } from '../../types/carrito'

type RoleItem = {
  id: number
  nombre: string
}

function fmtArs(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

function tipoLabel(tipo: 'equipo' | 'accesorio' | null | undefined) {
  if (tipo === 'equipo') return 'Equipo'
  if (tipo === 'accesorio') return 'Accesorio'
  return 'Producto'
}

export default function CarritoPage() {
  const [summary, setSummary] = useState<CarritoResumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [metodoPago, setMetodoPago] = useState('transferencia')
  const [checkoutInfo, setCheckoutInfo] = useState<CarritoCheckoutResponse | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const ensured = await carritoApi.ensure(!!getAccessToken())
      if (ensured.token_identificador) {
        setCartToken(ensured.token_identificador)
      }
      const data = await carritoApi.summary(!!getAccessToken())
      setSummary(data)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo cargar el carrito'
      if (
        message.toLowerCase().includes('otro usuario') ||
        message.toLowerCase().includes('carrito no encontrado')
      ) {
        try {
          regenerateCartToken()
          const ensured = await carritoApi.ensure(!!getAccessToken())
          if (ensured.token_identificador) {
            setCartToken(ensured.token_identificador)
          }
          const recovered = await carritoApi.summary(!!getAccessToken())
          setSummary(recovered)
          setError(null)
          return
        } catch (e2) {
          setError(e2 instanceof Error ? e2.message : 'No se pudo recuperar el carrito')
          return
        }
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const onCartChanged = (ev: Event) => {
      const detail = (ev as CustomEvent<CartChangedDetail>).detail
      if (detail?.summary) {
        setSummary(detail.summary as CarritoResumen)
        return
      }
      void load()
    }
    window.addEventListener(CART_CHANGED_EVENT, onCartChanged)
    return () => window.removeEventListener(CART_CHANGED_EVENT, onCartChanged)
  }, [load])

  async function updateQty(id: number, cant: number) {
    setCheckoutInfo(null)
    setBusyId(id)
    try {
      const data = await carritoApi.updateItem(id, cant, !!getAccessToken())
      setSummary(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el carrito')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: number) {
    setCheckoutInfo(null)
    setBusyId(id)
    try {
      const data = await carritoApi.removeItem(id, !!getAccessToken())
      setSummary(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el item')
    } finally {
      setBusyId(null)
    }
  }

  async function clearAll() {
    setCheckoutInfo(null)
    setBusyId(-1)
    try {
      const data = await carritoApi.clear(!!getAccessToken())
      setSummary(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo vaciar el carrito')
    } finally {
      setBusyId(null)
    }
  }

  async function checkout() {
    if (!getAccessToken()) {
      setError(null)
      setShowAuthModal(true)
      return
    }
    setCheckoutBusy(true)
    setError(null)
    try {
      const result = await carritoApi.checkout({ metodo_pago: metodoPago }, true)
      setCheckoutInfo(result)
      if (summary) {
        setSummary({
          ...summary,
          items: [],
          total_unidades: 0,
          total_importe: 0,
        })
      }
      window.open(result.whatsapp_url, '_self')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo confirmar la compra')
    } finally {
      setCheckoutBusy(false)
    }
  }

  const items = summary?.items ?? []

  async function handleAuthSuccess() {
    setShowAuthModal(false)
    setError(null)
    try {
      const ensured = await carritoApi.ensure(true)
      if (ensured.token_identificador) {
        setCartToken(ensured.token_identificador)
      }
      const updated = await carritoApi.summary(true)
      setSummary(updated)
    } catch {
      void load()
    }
  }

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1.5 text-[11px] tracking-widest text-gray-300 uppercase">
              Fix It · carrito
            </p>
            <h1 className="text-3xl font-black tracking-tight text-gray-900">Tu carrito</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400">
              Ajustá cantidades, eliminá items o seguí comprando en la tienda.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/tienda"
              className="inline-flex items-center justify-center rounded-full border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900"
            >
              Seguir comprando
            </Link>
            <button
              type="button"
              onClick={() => void clearAll()}
              className="inline-flex items-center justify-center rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              Vaciar carrito
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <AuthPromptModal
          open={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => void handleAuthSuccess()}
        />

        {checkoutInfo ? (
          <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {checkoutInfo.mensaje} Pedido #{checkoutInfo.id_pedido} · Pago #{checkoutInfo.id_pago} · Total{' '}
            {fmtArs(checkoutInfo.total)}. Si no se abrió WhatsApp, usá este enlace:{' '}
            <a
              className="font-semibold underline"
              href={checkoutInfo.whatsapp_url}
              target="_blank"
              rel="noreferrer"
            >
              abrir chat
            </a>
            .
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-gray-400">Cargando carrito…</p>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/80 px-8 py-16 text-center">
            <p className="text-gray-500">
              Tu carrito está vacío.{' '}
              <Link to="/tienda" className="font-medium text-gray-900 underline">
                Ir a la tienda
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
            <div className="space-y-4">
              {items.map((item) => {
                const producto = item.producto
                return (
                  <article
                    key={item.id}
                    className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[11px] tracking-widest text-gray-300 uppercase">
                          {producto?.nombre ?? `Producto #${item.id_producto}`}
                        </p>
                        <p className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-gray-500 uppercase">
                          {tipoLabel(producto?.tipo_producto)}
                        </p>
                        <h2 className="mt-1 text-lg font-bold text-gray-900">
                          {producto?.nombre ?? 'Producto sin nombre'}
                        </h2>
                        <p className="mt-1 text-sm text-gray-400">
                          Unitario: {fmtArs(item.precio_unitario)} · Subtotal: {fmtArs(item.subtotal)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busyId === item.id || item.cant <= 1}
                          onClick={() => void updateQty(item.id, item.cant - 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition-colors hover:border-gray-400 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="min-w-10 text-center text-sm font-semibold text-gray-900">
                          {item.cant}
                        </span>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void updateQty(item.id, item.cant + 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition-colors hover:border-gray-400 disabled:opacity-40"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void remove(item.id)}
                          className="ml-2 rounded-full border border-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-40"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            <aside className="h-fit rounded-3xl border border-gray-100 bg-gray-50 p-6 shadow-sm">
              <p className="text-[11px] tracking-widest text-gray-300 uppercase">Resumen</p>
              <div className="mt-4 space-y-3 text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Items</span>
                  <strong className="text-gray-900">{summary?.total_unidades ?? 0}</strong>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                  <span>Total</span>
                  <strong className="text-lg text-gray-900">{fmtArs(summary?.total_importe)}</strong>
                </div>
              </div>
              <button
                type="button"
                disabled={checkoutBusy || items.length === 0}
                onClick={() => void checkout()}
                className="mt-6 w-full rounded-full bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700"
              >
                {checkoutBusy ? 'Procesando compra…' : 'Confirmar compra'}
              </button>

              <label className="mt-3 block text-xs font-medium text-gray-500" htmlFor="metodoPago">
                Método de pago
              </label>
              <select
                id="metodoPago"
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                disabled={checkoutBusy}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              >
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="efectivo">Efectivo</option>
              </select>
              <p className="mt-3 text-xs leading-relaxed text-gray-400">
                El checkout crea pedido pendiente y te redirige a WhatsApp con el detalle de productos y cantidades.
              </p>
            </aside>
          </div>
        )}
      </section>
    </div>
  )
}

type AuthPromptModalProps = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

function AuthPromptModal({ open, onClose, onSuccess }: AuthPromptModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [telefono, setTelefono] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')

  if (!open) return null

  async function parseError(res: Response) {
    const text = await res.text()
    let detail = res.statusText
    try {
      const j = JSON.parse(text) as { detail?: string }
      if (typeof j.detail === 'string') detail = j.detail
    } catch {
      if (text) detail = text
    }
    return detail || `HTTP ${res.status}`
  }

  async function login(email: string, password: string) {
    const res = await fetch(apiUrl('/login/post'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      throw new Error(await parseError(res))
    }
    const j = (await res.json()) as {
      access_token: string
      refresh_token: string
    }
    setAuthTokens(j.access_token, j.refresh_token)
    const ensured = await carritoApi.ensure(true)
    if (ensured.token_identificador) {
      setCartToken(ensured.token_identificador)
    }
  }

  async function getClienteRoleId(): Promise<number> {
    const res = await fetch(apiUrl('/roles/get'))
    if (!res.ok) {
      throw new Error(await parseError(res))
    }
    const roles = (await res.json()) as RoleItem[]
    if (!Array.isArray(roles) || roles.length === 0) {
      throw new Error('No hay roles disponibles para crear la cuenta.')
    }
    const cliente = roles.find((r) => (r.nombre ?? '').toLowerCase().includes('cliente'))
    return (cliente ?? roles[0]).id
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(loginEmail, loginPassword)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const idRolCliente = await getClienteRoleId()
      const res = await fetch(apiUrl('/usuarios/post'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          apellido,
          telefono: telefono || null,
          email: registerEmail,
          password_hash: registerPassword,
          id_rol: idRolCliente,
        }),
      })
      if (!res.ok) {
        throw new Error(await parseError(res))
      }

      await login(registerEmail, registerPassword)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-gray-300 uppercase">Fix It</p>
            <h2 className="text-2xl font-black tracking-tight text-gray-900">
              {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Para confirmar la compra, primero autenticá tu cuenta.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-full bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError(null)
            }}
            className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
              mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Ingresar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register')
              setError(null)
            }}
            className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
              mode === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Crear cuenta
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {mode === 'login' ? (
          <form className="space-y-3" onSubmit={(e) => void submitLogin(e)}>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Contraseña</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-full bg-gray-900 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-60"
            >
              {loading ? 'Ingresando…' : 'Ingresar y continuar'}
            </button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={(e) => void submitRegister(e)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Nombre</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Apellido</label>
                <input
                  type="text"
                  required
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Teléfono</label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Contraseña</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                minLength={6}
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-full bg-gray-900 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-60"
            >
              {loading ? 'Creando cuenta…' : 'Crear cuenta e ingresar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}