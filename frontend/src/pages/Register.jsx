import logo from '../assets/logo1.png'
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Register() {
  const [nume, setNume] = useState('')
  const [email, setEmail] = useState('')
  const [parola, setParola] = useState('')
  const [eroare, setEroare] = useState('')
  const [loading, setLoading] = useState(false)

  const { register } = useAuth()
  const navigate = useNavigate()

  const handleRegister = async (e) => {
    e.preventDefault()
    setEroare('')
    setLoading(true)
    try {
      await register(email, parola, nume)
      navigate('/')
    } catch (error) {
      console.log('Eroare register:', error)
      setEroare('Nu s-a putut crea contul. Poate emailul e deja folosit.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.pagina}>
      <div style={styles.card}>

        {/* Logo */}
        <div style={styles.logoArea}>
          <img src={logo} alt="RenewRO" style={{ width: '120px', marginBottom: '8px' }} />
        </div>
        <h2 style={styles.titlu}>Creează un cont RenewRO</h2>
        <p style={styles.subtitlu}>Completează datele ca să începi.</p>

        {/* Formular */}
        <form onSubmit={handleRegister} style={styles.form}>
          <input
            type="text"
            placeholder="Nume"
            value={nume}
            onChange={(e) => setNume(e.target.value)}
            style={styles.input}
          />
          <input
            type="email"
            placeholder="Adresa de e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Parolă"
            value={parola}
            onChange={(e) => setParola(e.target.value)}
            style={styles.input}
            required
          />

          {eroare && <div style={styles.eroare}>{eroare}</div>}

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Se creează...' : 'Înregistrează-te'}
          </button>
        </form>

        <p style={styles.link}>
          Ai deja cont?{' '}
          <Link to="/login" style={styles.linkText}>Conectează-te!</Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  pagina: {
    minHeight: '100vh',
    background: '#F5F3EE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Segoe UI, sans-serif',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    textAlign: 'center',
  },
  logoArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '24px',
  },
  titlu: { fontSize: '20px', fontWeight: '600', color: '#1a1a1a', marginBottom: '8px' },
  subtitlu: { fontSize: '14px', color: '#888', marginBottom: '28px' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1.5px solid #E0DDD6',
    fontSize: '14px',
    background: '#F5F3EE',
    outline: 'none',
  },
  eroare: { background: '#FEECEC', color: '#C0392B', padding: '10px', borderRadius: '8px', fontSize: '13px' },
  btn: {
    padding: '13px',
    background: '#1D9E75',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '4px',
  },
  link: { marginTop: '20px', fontSize: '13px', color: '#888' },
  linkText: { color: '#1D9E75', fontWeight: '500', textDecoration: 'none' },
}
