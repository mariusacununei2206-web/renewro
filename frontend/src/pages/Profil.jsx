import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getSimulari, seteazaPrincipala } from '../services/api.js'

export default function Profil() {
  const { utilizator } = useAuth()
  const [simulari, setSimulari] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSimulari()
      .then(setSimulari)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false))
  }, [])

  // Marcheaza o simulare ca principala, apoi reincarca lista
  async function facePrincipala(id) {
    try {
      await seteazaPrincipala(id)
      setSimulari(await getSimulari())
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <Layout>
      <div style={styles.pagina}>
        <div style={styles.header}>
          <h1 style={styles.titlu}>Profilul meu</h1>
          <p style={styles.subtitlu}>{utilizator?.nume || utilizator?.email}</p>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitlu}>Cont</div>
          <div style={styles.rand}><span style={styles.label}>Nume</span><span style={styles.val}>{utilizator?.nume || '—'}</span></div>
          <div style={styles.rand}><span style={styles.label}>Email</span><span style={styles.val}>{utilizator?.email}</span></div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitlu}>Simulările mele salvate</div>
          <p style={styles.hint}>Cea marcată „principală" apare pe pagina Acasă.</p>
          {loading ? (
            <p style={styles.gol}>Se încarcă…</p>
          ) : simulari.length === 0 ? (
            <p style={styles.gol}>
              Nicio simulare salvată încă. Mergi la „Simulare investiție" și apasă „Salvează simularea".
            </p>
          ) : (
            simulari.map((s) => (
              <div key={s.id_simulare} style={styles.simRow}>
                <span style={styles.simJudet}>
                  <strong>{s.judet}</strong> · {s.putere_kwp} kWp · autoconsum {Math.round(s.autoconsum * 100)}%
                </span>
                <span style={styles.simNpv}>NPV {Math.round(s.npv).toLocaleString('ro-RO')} lei</span>
                <span style={styles.simData}>{s.data?.slice(0, 10)}</span>
                {s.principala ? (
                  <span style={styles.principalaBadge}>★ Principală</span>
                ) : (
                  <button style={styles.btnPrincipala} onClick={() => facePrincipala(s.id_simulare)}>Fă principală</button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  )
}

const styles = {
  pagina: { padding: '28px 32px', maxWidth: '900px' },
  header: { marginBottom: '20px' },
  titlu: { fontSize: '24px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' },
  subtitlu: { fontSize: '14px', color: '#888' },
  card: { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '16px' },
  cardTitlu: { fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '14px' },
  rand: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '8px 0', borderBottom: '0.5px solid #f0f0f0' },
  label: { color: '#666' },
  val: { color: '#1D9E75', fontWeight: 500 },
  gol: { fontSize: '13px', color: '#888', margin: 0 },
  simRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', fontSize: '13px', padding: '10px 0', borderBottom: '0.5px solid #f0f0f0' },
  simJudet: { flex: 1, color: '#444' },
  simNpv: { color: '#1D9E75', fontWeight: 600 },
  simData: { color: '#aaa', fontSize: '12px', width: '90px', textAlign: 'right' },
  hint: { fontSize: '12px', color: '#aaa', margin: '-8px 0 14px' },
  principalaBadge: { fontSize: '11px', fontWeight: 700, color: '#0F6E56', background: '#E1F5EE', borderRadius: '6px', padding: '5px 10px', whiteSpace: 'nowrap' },
  btnPrincipala: { fontSize: '11px', color: '#1D9E75', background: '#fff', border: '1.5px solid #1D9E75', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap' },
}
