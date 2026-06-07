import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [nume, setNume] = useState('')
  const [email, setEmail] = useState('')
  const [parola, setParola] = useState('')
  const [eroare, setEroare] = useState('')
  const [loading, setLoading] = useState(false)

  async function trimite(e) {
    e.preventDefault()
    setLoading(true)
    setEroare('')
    try {
      await register(email, parola, nume)
      navigate('/')
    } catch (err) {
      setEroare(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.fundal}>
      <form onSubmit={trimite} style={styles.card}>
        <h1 style={styles.titlu}>RenewRO</h1>
        <p style={styles.subtitlu}>Creează cont</p>
        <input style={styles.input} type="text" placeholder="Nume"
               value={nume} onChange={(e) => setNume(e.target.value)} />
        <input style={styles.input} type="email" placeholder="Email"
               value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input style={styles.input} type="password" placeholder="Parolă"
               value={parola} onChange={(e) => setParola(e.target.value)} required />
        {eroare && <div style={styles.eroare}>{eroare}</div>}
        <button style={styles.buton} disabled={loading}>
          {loading ? 'Se creează…' : 'Înregistrare'}
        </button>
        <p style={styles.jos}>Ai deja cont? <Link to="/login" style={styles.link}>Conectează-te</Link></p>
      </form>
    </div>
  )
}

const styles = {
  fundal: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F3EE', fontFamily: 'Segoe UI, sans-serif' },
  card: { background: '#fff', borderRadius: '14px', padding: '32px', width: '340px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '12px' },
  titlu: { margin: 0, color: '#1D9E75', fontSize: '26px', textAlign: 'center' },
  subtitlu: { margin: '0 0 8px', color: '#888', fontSize: '14px', textAlign: 'center' },
  input: { padding: '11px 12px', borderRadius: '8px', border: '1.5px solid #E0DDD6', fontSize: '14px', background: '#F5F3EE' },
  buton: { padding: '12px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },
  eroare: { background: '#FEECEC', color: '#C0392B', padding: '9px', borderRadius: '8px', fontSize: '13px' },
  jos: { textAlign: 'center', fontSize: '13px', color: '#666', margin: 0 },
  link: { color: '#1D9E75', fontWeight: 600, textDecoration: 'none' },
}
