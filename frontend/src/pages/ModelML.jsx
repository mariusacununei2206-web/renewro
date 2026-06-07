import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { getValidareML, getClustereML } from '../services/api.js'

const CULORI_CLASE = ['#5DCAA5', '#1D9E75', '#0F6E56']            // 0 mic -> 2 mare
const ETICHETE_CLASE = ['Potențial scăzut', 'Potențial mediu', 'Potențial ridicat']

export default function ModelML() {
  const [validare, setValidare] = useState(null)
  const [clustere, setClustere] = useState([])
  const [loading, setLoading] = useState(true)
  const [eroare, setEroare] = useState(null)

  // La pornire: antreneaza + valideaza + clusterizeaza
  useEffect(() => {
    Promise.all([getValidareML(), getClustereML(3)])
      .then(([v, c]) => { setValidare(v); setClustere(c) })
      .catch((e) => setEroare(e.message))
      .finally(() => setLoading(false))
  }, [])

  const imbunatatire = validare ? validare.mae_baseline_sezonier / validare.mae : 0

  return (
    <Layout>
      <div style={styles.pagina}>
        <div style={styles.header}>
          <h1 style={styles.titlu}>Model Machine Learning</h1>
          <p style={styles.subtitlu}>
            Estimarea radiației (supervizat) + clasificarea județelor (nesupervizat)
          </p>
        </div>

        {eroare && <p style={styles.eroare}>⚠️ {eroare} (e pornit backend-ul?)</p>}
        {loading && <p style={styles.loading}>Se antrenează modelul…</p>}

        {validare && (
          <>
            <div style={styles.sectiune}>1. Estimator de radiație — Random Forest</div>
            <div style={styles.kpiGrid}>
              <Kpi label="R² (test)" val={validare.r2.toFixed(3)} sub="cât explică modelul" />
              <Kpi label="MAE" val={validare.mae.toFixed(3)} sub="kWh/m²/zi" />
              <Kpi label="MAPE" val={`${validare.mape.toFixed(1)}%`} sub="eroare medie" />
              <Kpi label="R² cross-val" val={validare.cv_r2_mediu.toFixed(3)} sub={`±${validare.cv_r2_std.toFixed(3)} · 5 felii`} />
            </div>
            <div style={styles.card}>
              <div style={styles.cardTitlu}>Comparație cu baseline-ul sezonier</div>
              <p style={styles.text}>
                Modelul ML are MAE = <strong>{validare.mae.toFixed(3)}</strong>, față de
                baseline-ul „media lunii" cu MAE = <strong>{validare.mae_baseline_sezonier.toFixed(3)}</strong>
                {' '}→ modelul e de <strong>{imbunatatire.toFixed(1)}×</strong> mai precis
                (adaugă rezoluție spațială pe care media lunii nu o are).
                Antrenat pe <strong>{validare.n_total}</strong> înregistrări, testat pe <strong>{validare.n_test}</strong>.
              </p>
            </div>
          </>
        )}

        {clustere.length > 0 && (
          <>
            <div style={styles.sectiune}>2. Clasificarea județelor — K-means</div>
            <div style={styles.card}>
              <div style={styles.cardTitlu}>Cele 8 județe grupate în clase de potențial</div>
              {[2, 1, 0].map((clasa) => {
                const inClasa = clustere.filter((c) => c.cluster === clasa)
                if (!inClasa.length) return null
                return (
                  <div key={clasa} style={styles.clasaBloc}>
                    <div style={{ ...styles.clasaBadge, background: CULORI_CLASE[clasa] }}>
                      {ETICHETE_CLASE[clasa]}
                    </div>
                    <div style={styles.clasaJudete}>
                      {inClasa.map((c) => (
                        <span key={c.nume} style={styles.judetChip}>
                          {c.nume} <small style={{ color: '#888' }}>({c.ghi_mediu.toFixed(2)} kWh/m²/zi)</small>
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}

function Kpi({ label, val, sub }) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiLabel}>{label}</div>
      <div style={styles.kpiVal}>{val}</div>
      <div style={styles.kpiSub}>{sub}</div>
    </div>
  )
}

const styles = {
  pagina: { padding: '28px 32px', maxWidth: '1100px' },
  header: { marginBottom: '20px' },
  titlu: { fontSize: '24px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' },
  subtitlu: { fontSize: '14px', color: '#888' },
  sectiune: { fontSize: '15px', fontWeight: '600', color: '#1D9E75', margin: '18px 0 12px' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '16px' },
  kpiCard: { background: '#1D9E75', borderRadius: '12px', padding: '18px', color: '#fff', textAlign: 'center' },
  kpiLabel: { fontSize: '12px', opacity: 0.85, marginBottom: '6px' },
  kpiVal: { fontSize: '24px', fontWeight: '700' },
  kpiSub: { fontSize: '10px', opacity: 0.7, marginTop: '4px' },
  card: { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '16px' },
  cardTitlu: { fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '12px' },
  text: { fontSize: '13px', color: '#444', lineHeight: '1.7', margin: 0 },
  clasaBloc: { marginBottom: '16px' },
  clasaBadge: { display: 'inline-block', color: '#fff', borderRadius: '20px', padding: '4px 14px', fontSize: '12px', fontWeight: '600', marginBottom: '8px' },
  clasaJudete: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  judetChip: { background: '#F5F3EE', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', color: '#1a1a1a' },
  eroare: { color: '#b91c1c', fontWeight: 600 },
  loading: { color: '#888' },
}
