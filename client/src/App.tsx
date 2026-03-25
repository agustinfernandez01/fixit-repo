import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { AdminLayout } from './components/layout/AdminLayout'
import { InventarioLayout } from './components/layout/InventarioLayout'
import { HomePage } from './pages/HomePage'
import { AdminHomePage } from './pages/AdminHomePage'
import { ModelosPage } from './pages/inventario/ModelosPage'
import { EquiposPage } from './pages/inventario/EquiposPage'
import { DepositosPage } from './pages/inventario/DepositosPage'
import { EquipoDepositoPage } from './pages/inventario/EquipoDepositoPage'
import { EquiposUsadosDetallePage } from './pages/inventario/EquiposUsadosDetallePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminHomePage />} />
            <Route path="inventario" element={<InventarioLayout />}>
              <Route
                index
                element={
                  <Navigate to="/admin/inventario/modelos" replace />
                }
              />
              <Route path="modelos" element={<ModelosPage />} />
              <Route path="equipos" element={<EquiposPage />} />
              <Route path="depositos" element={<DepositosPage />} />
              <Route path="ubicaciones" element={<EquipoDepositoPage />} />
              <Route
                path="equipos-usados"
                element={<EquiposUsadosDetallePage />}
              />
            </Route>
          </Route>
          <Route
            path="/inventario/*"
            element={<Navigate to="/admin/inventario/modelos" replace />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
