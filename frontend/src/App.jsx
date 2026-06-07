import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Harta from './pages/Harta.jsx'
import Simulator from './pages/Simulator.jsx'
import ModelML from './pages/ModelML.jsx'

// Rutele aplicatiei (fiecare pagina isi pune singura Layout-ul)
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/harta" element={<Harta />} />
        <Route path="/simulator" element={<Simulator />} />
        <Route path="/ml" element={<ModelML />} />
      </Routes>
    </BrowserRouter>
  )
}
