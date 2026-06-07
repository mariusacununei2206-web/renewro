import { NavLink } from 'react-router-dom'
import logo from '../assets/logo1.png'

const navItems = [
  { path: '/', label: 'Acasă', icon: '🏠' },
  { path: '/harta', label: 'Vizualizare hartă', icon: '🗺️' },
  { path: '/simulator', label: 'Simulare investiție', icon: '💰' },
  { path: '/ml', label: 'Model ML', icon: '🤖' },
]

export default function Sidebar() {
  const azi = new Date().toLocaleDateString('ro-RO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logoArea}>
        <img src={logo} alt="RenewRO" style={styles.logo} />
      </div>

      {/* Navigare */}
      <nav style={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {}),
            })}
          >
            <span style={styles.navIcon}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={styles.footer}>
        <div style={styles.footerDate}>{azi}</div>
        <div style={styles.footerApp}>RenewRO · Regiunea Moldova</div>
      </div>
    </div>
  )
}

const styles = {
  sidebar: {
    width: '220px',
    minHeight: '100vh',
    background: '#1D9E75',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  logoArea: { padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.15)' },
  logo: { width: '100%', maxWidth: '120px', display: 'block', margin: '0 auto', filter: 'brightness(0) invert(1)' },
  nav: { display: 'flex', flexDirection: 'column', padding: '16px 0', flex: 1 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 20px',
    color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontSize: '13px',
    borderLeft: '3px solid transparent', transition: 'all 0.15s',
  },
  navItemActive: { background: 'rgba(255,255,255,0.15)', color: '#fff', borderLeft: '3px solid #fff' },
  navIcon: { fontSize: '16px' },
  footer: { padding: '16px', borderTop: '1px solid rgba(255,255,255,0.15)' },
  footerDate: { color: 'rgba(255,255,255,0.7)', fontSize: '11px', marginBottom: '4px' },
  footerApp: { color: 'rgba(255,255,255,0.85)', fontSize: '11px' },
}
