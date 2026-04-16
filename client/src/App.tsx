import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './layout/AdminLayout'
import ClientLayout from './layout/ClientLayout'
import { InventarioLayout } from './components/layout/InventarioLayout'
import { AdminHomePage } from './pages/AdminHomePage'
import PedidosPage from './pages/admin/PedidosPage'
import Home from './pages/client/HomeView'
import MarketplaceTiendaPage from './pages/client/MarketplaceTiendaPage'
import CanjePage from './pages/client/CanjePage'
import PublicarCelularPage from './pages/client/PublicarCelularPage'
import LoginPage from './pages/client/LoginPage'
import ReparacionesPage from './pages/client/ReparacionesPage'
import TiendaPage from './pages/client/TiendaPage'
import CarritoPage from './pages/client/CarritoPage'
import ProductoDetallePage from './pages/client/ProductoDetallePage'
import PerfilPage from './pages/client/PerfilPage'
import { ModelosPage } from './pages/inventario/ModelosPage'
import { EquiposPage } from './pages/inventario/EquiposPage'
import { AccesoriosPage } from './pages/inventario/AccesoriosPage'
import { CanjeCotizacionesPage } from './pages/inventario/CanjeCotizacionesPage'
import { DepositosPage } from './pages/inventario/DepositosPage'
import { EquipoDepositoPage } from './pages/inventario/EquipoDepositoPage'
import { EquiposUsadosDetallePage } from './pages/inventario/EquiposUsadosDetallePage'
import { MarketplaceLayout } from './components/layout/MarketplaceLayout'
import { PublicacionesPage } from './pages/marketplace/PublicacionesPage'
import { RevisionesPage } from './pages/marketplace/RevisionesPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ClientLayout />}>
        <Route index element={<Home />} />
        <Route path="tienda" element={<TiendaPage />} />
        <Route path="marketplace" element={<MarketplaceTiendaPage />} />
        <Route path="canje" element={<CanjePage />} />
        <Route path="reparaciones" element={<ReparacionesPage />} />
        <Route path="publicar" element={<PublicarCelularPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="carrito" element={<CarritoPage />} />
        <Route path="perfil" element={<PerfilPage />} />
        <Route path="producto/:id" element={<ProductoDetallePage />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminHomePage />} />
        <Route path="pedidos" element={<PedidosPage />} />
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
          <Route path="revisiones" element={<RevisionesPage />} />
        </Route>
      </Route>

      <Route
        path="/inventario/*"
        element={<Navigate to="/admin/inventario/modelos" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
