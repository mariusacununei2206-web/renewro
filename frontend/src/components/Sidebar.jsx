import { NavLink } from 'react-router-dom'
import logo from '../assets/logo1.png'
import { useAuth } from '../context/AuthContext.jsx'
import { IconAcasa, IconHarta, IconSimulare, IconComparatii, IconML, IconProfil } from './Icoane.jsx'
import WidgetVreme from './WidgetVreme.jsx'

const navItems = [
  { path: '/', label: 'Acasă', Icon: IconAcasa },
  { path: '/harta', label: 'Vizualizare hartă', Icon: IconHarta },
  { path: '/simulator', label: 'Simulare investiție', Icon: IconSimulare },
  { path: '/comparatii', label: 'Comparații', Icon: IconComparatii },
  { path: '/ml', label: 'Model ML', Icon: IconML },
]

export default function Sidebar() {
  const { utilizator, logout } = useAuth()

  return (
    <div style={styles.sidebar}>
      <div style={styles.logoArea}>
        <img src={logo} alt="RenewRO" style={styles.logo} />
      </div>

      <nav style={styles.nav}>
        {navItems.map(({ path, label, Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            style={({ isActive }) => ({ ...styles.navItem, ...(isActive ? styles.navItemActive : {}) })}
          >
            <span style={styles.navIcon}><Icon /></span>
            {label}
          </NavLink>
        ))}
        {utilizator && (
          <NavLink
            to="/profil"
            style={({ isActive }) => ({ ...styles.navItem, ...(isActive ? styles.navItemActive : {}) })}
          >
            <span style={styles.navIcon}><IconProfil /></span>
            Profilul meu
          </NavLink>
        )}
      </nav>

      <WidgetVreme />

      <div style={styles.footer}>
        {utilizator ? (
          <>
            <div style={styles.footerUser}>{utilizator.nume || utilizator.email}</div>
            <button onClick={logout} style={styles.logoutBtn}>Deconectare</button>
          </>
        ) : (
          <NavLink to="/login" style={styles.loginLink}>Autentificare</NavLink>
        )}
      </div>
    </div>
  )
}

const styles = {
  sidebar: { width: '220px', minHeight: '100vh', background: '#1D9E75', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  logoArea: { padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.15)' },
  logo: { width: '100%', maxWidth: '120px', display: 'block', margin: '0 auto', filter: 'brightness(0) invert(1)' },
  nav: { display: 'flex', flexDirection: 'column', padding: '16px 0', flex: 1 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 20px',
    color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: '13px',
    borderLeft: '3px solid transparent',
  },
  navItemActive: { background: 'rgba(255,255,255,0.15)', color: '#fff', borderLeft: '3px solid #fff' },
  navIcon: { display: 'inline-flex', alignItems: 'center' },
  footer: { padding: '16px', borderTop: '1px solid rgba(255,255,255,0.15)' },
  footerDate: { color: 'rgba(255,255,255,0.7)', fontSize: '11px', marginBottom: '6px' },
  footerUser: { color: 'rgba(255,255,255,0.9)', fontSize: '12px', marginBottom: '8px', wordBreak: 'break-all' },
  logoutBtn: {
    width: '100%', padding: '7px', background: 'rgba(255,255,255,0.15)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
  },
  loginLink: {
    display: 'block', textAlign: 'center', padding: '7px', background: 'rgba(255,255,255,0.15)',
    color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', fontSize: '12px', textDecoration: 'none',
  },
}
