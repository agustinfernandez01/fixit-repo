import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ClientLayout from './layout/ClientLayout'
import Home from './pages/client/HomeView'
import TiendaPage from './pages/client/TiendaPage'

// Code-splitting por ruta: el bundle único de ~614 KB obligaba a descargar el árbol
// completo de /admin (y los 17 JPGs de ComparativaPage) para ver el home.
// Home, TiendaPage y el layout público quedan en el bundle inicial porque son la
// primera pantalla; todo lo demás se carga bajo demanda.
const AdminLayout = lazy(() => import('./layout/AdminLayout'))
const InventarioLayout = lazy(() =>
  import('./components/layout/InventarioLayout').then((m) => ({ default: m.InventarioLayout })),
)
const MarketplaceLayout = lazy(() =>
  import('./components/layout/MarketplaceLayout').then((m) => ({ default: m.MarketplaceLayout })),
)

const AdminHomePage = lazy(() =>
  import('./pages/AdminHomePage').then((m) => ({ default: m.AdminHomePage })),
)
const PedidosPage = lazy(() => import('./pages/admin/PedidosPage'))
const SolicitudesCanjePage = lazy(() => import('./pages/admin/SolicitudesCanjePage'))

const MarketplaceTiendaPage = lazy(() => import('./pages/client/MarketplaceTiendaPage'))
const MarketplacePublicacionesPage = lazy(
  () => import('./pages/client/MarketplacePublicacionesPage'),
)
const MarketplaceDetallePage = lazy(() => import('./pages/client/MarketplaceDetallePage'))
const CanjePage = lazy(() => import('./pages/client/CanjePage'))
const PublicarCelularPage = lazy(() => import('./pages/client/PublicarCelularPage'))
const LoginPage = lazy(() => import('./pages/client/LoginPage'))
const ForgotPasswordPage = lazy(() => import('./pages/client/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/client/ResetPasswordPage'))
const RegisterPage = lazy(() => import('./pages/client/RegisterPage'))
const ReparacionesPage = lazy(() => import('./pages/client/ReparacionesPage'))
const CarritoPage = lazy(() => import('./pages/client/CarritoPage'))
const ProductoDetallePage = lazy(() => import('./pages/client/ProductoDetallePage'))
const PerfilPage = lazy(() => import('./pages/client/PerfilPage'))
// ComparativaPage arrastra un directorio de imágenes de ~1,7 MB: chunk propio.
const ComparativaPage = lazy(() => import('./pages/client/ComparativaPage'))

const ModelosPage = lazy(() =>
  import('./pages/inventario/ModelosPage').then((m) => ({ default: m.ModelosPage })),
)
const EquiposPage = lazy(() =>
  import('./pages/inventario/EquiposPage').then((m) => ({ default: m.EquiposPage })),
)
const AccesoriosPage = lazy(() =>
  import('./pages/inventario/AccesoriosPage').then((m) => ({ default: m.AccesoriosPage })),
)
const CanjeCotizacionesPage = lazy(() =>
  import('./pages/inventario/CanjeCotizacionesPage').then((m) => ({
    default: m.CanjeCotizacionesPage,
  })),
)
const DepositosPage = lazy(() =>
  import('./pages/inventario/DepositosPage').then((m) => ({ default: m.DepositosPage })),
)
const EquipoDepositoPage = lazy(() =>
  import('./pages/inventario/EquipoDepositoPage').then((m) => ({ default: m.EquipoDepositoPage })),
)
const EquiposUsadosDetallePage = lazy(() =>
  import('./pages/inventario/EquiposUsadosDetallePage').then((m) => ({
    default: m.EquiposUsadosDetallePage,
  })),
)
const PublicacionesPage = lazy(() =>
  import('./pages/marketplace/PublicacionesPage').then((m) => ({ default: m.PublicacionesPage })),
)

function CargandoRuta() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" />
      <span className="sr-only">Cargando…</span>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<CargandoRuta />}>
      <Routes>
        <Route path="/" element={<ClientLayout />}>
          <Route index element={<Home />} />
          <Route path="tienda" element={<TiendaPage />} />
          <Route path="usados" element={<MarketplaceTiendaPage />} />
          <Route path="marketplace" element={<MarketplacePublicacionesPage />} />
          <Route path="marketplace/:id" element={<MarketplaceDetallePage />} />
          <Route path="canje" element={<CanjePage />} />
          <Route path="reparaciones" element={<ReparacionesPage />} />
          <Route path="publicar" element={<PublicarCelularPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="recuperar" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="registro" element={<RegisterPage />} />
          <Route path="carrito" element={<CarritoPage />} />
          <Route path="perfil" element={<PerfilPage />} />
          <Route path="producto/:id" element={<ProductoDetallePage />} />
          <Route path="comparativa" element={<ComparativaPage />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHomePage />} />
          <Route path="pedidos" element={<PedidosPage />} />
          <Route path="solicitudes-canje" element={<SolicitudesCanjePage />} />
          <Route path="inventario" element={<InventarioLayout />}>
            <Route
              index
              element={<Navigate to="/admin/inventario/modelos" replace />}
            />
            <Route path="modelos" element={<ModelosPage />} />
            <Route path="equipos" element={<EquiposPage />} />
            <Route path="accesorios" element={<AccesoriosPage />} />
            <Route path="canje" element={<CanjeCotizacionesPage />} />
            <Route
              path="canje-modelos"
              element={<Navigate to="/admin/inventario/canje" replace />}
            />
            <Route
              path="canje-cotizaciones"
              element={<Navigate to="/admin/inventario/canje" replace />}
            />
            <Route path="depositos" element={<DepositosPage />} />
            <Route path="ubicaciones" element={<EquipoDepositoPage />} />
            <Route
              path="equipos-usados"
              element={<EquiposUsadosDetallePage />}
            />
          </Route>
          <Route path="marketplace" element={<MarketplaceLayout />}>
            <Route
              index
              element={<Navigate to="/admin/marketplace/publicaciones" replace />}
            />
            <Route path="publicaciones" element={<PublicacionesPage />} />
          </Route>
        </Route>

        <Route
          path="/inventario/*"
          element={<Navigate to="/admin/inventario/modelos" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
