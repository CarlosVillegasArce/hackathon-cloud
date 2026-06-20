import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import UploadPage from './pages/UploadPage.jsx'
import ResultadosPage from './pages/ResultadosPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/upload" replace />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/resultados" element={<ResultadosPage />} />
        <Route path="*" element={<Navigate to="/upload" replace />} />
      </Route>
    </Routes>
  )
}
