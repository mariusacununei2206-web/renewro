import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Harta from './pages/Harta.jsx'
import Simulator from './pages/Simulator.jsx'
import Comparatii from './pages/Comparatii.jsx'
import ModelML from './pages/ModelML.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Profil from './pages/Profil.jsx'

// Ruta accesibila doar utilizatorilor autentificati
function RutaProtejata({ children }) {
  const { utilizator, gata } = useAuth()
  if (!gata) return null            // asteptam verificarea token-ului
  return utilizator ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/harta" element={<Harta />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/comparatii" element={<Comparatii />} />
          <Route path="/ml" element={<ModelML />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profil" element={<RutaProtejata><Profil /></RutaProtejata>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
