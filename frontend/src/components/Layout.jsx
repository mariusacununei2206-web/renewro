import Sidebar from './Sidebar.jsx'

// Structura: bara laterala (Sidebar) + zona principala de continut
export default function Layout({ children }) {
  return (
    <div style={styles.container}>
      <Sidebar />
      <main style={styles.main}>{children}</main>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: 'Segoe UI, sans-serif',
    background: '#F5F3EE',
  },
  main: { flex: 1, overflow: 'auto' },
}
