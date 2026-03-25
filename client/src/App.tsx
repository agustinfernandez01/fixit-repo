import { Route, Routes } from 'react-router-dom'

import AdminLayout from './layout/adminlayout.tsx'
import ClientLayout from './layout/clientlayout.tsx'
import Dashboard from './pages/admin/AdminDashboard.tsx'
import Home from './pages/client/HomeView.tsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<ClientLayout />}>
        <Route index element={<Home />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
      </Route>
    </Routes>
  )
}

export default App