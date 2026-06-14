import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { getValidareML, getClustereML, getEstimareML, getJudete } from '../services/api.js'
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell, LabelList,
} from 'recharts'

const CULORI_CLASE = ['#5DCAA5', '#1D9E75', '#0F6E56']            // 0 mic -> 2 mare
const ETICHETE_CLASE = ['Potențial scăzut', 'Potențial mediu', 'Potențial ridicat']
const LUNI = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec']

export default function ModelML() {
  const [validare, setValidare] = useState(null)
  const [clustere, setClustere] = useState([])
  const [judete, setJudete] = useState([])
  const [loading, setLoading] = useState(true)
  const [eroare, setEroare] = useState(null)

  // Estimator interactiv
  const [judetSel, setJudetSel] = useState(null)
  const [luna, setLuna] = useState(6)
  const [temp, setTemp] = useState(18)
  const [vant, setVant] = useState(3.5)
  const [ghiEstimat, setGhiEstimat] = useState(null)

  // La pornire: validare + clustere + judete
  useEffect(() => {
    Promise.all([getValidareML(), getClustereML(3), getJudete()])
      .then(([v, c, j]) => {
        setValidare(v)
        setClustere(c)
        setJudete(j)
        if (j.length) setJudetSel(j[0])
      })
      .catch((e) => setEroare(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Estimare LIVE cand se schimba intrarile (cu mic debounce)
  useEffect(() => {
    if (!judetSel) return
    let activ = true
    const t = setTimeout(() => {
      getEstimareML(judetSel.latitudine, judetSel.longitudine, luna, temp, vant)
        .then((r) => { if (activ) setGhiEstimat(r.ghi_estimat) })
        .catch(() => { if (activ) setGhiEstimat(null) })
    }, 250)
    return () => { activ = false; clearTimeout(t) }
  }, [judetSel, luna, temp, vant])

  const imbunatatire = validare ? validare.mae_baseline_sezonier / validare.mae : 0

  return (
    <Layout>
      <div style={styles.pagina}>
        <div style={styles.header}>
          <h1 style={styles.titlu}>Model Machine Learning</h1>
          <p style={styles.subtitlu}>Estimarea radiației (supervizat) + clasificarea județelor (nesupervizat)</p>
        </div>

        {eroare && <p style={styles.eroare}>{eroare} (e pornit backend-ul?)</p>}
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

            {/* A. Estimator interactiv */}
            <div style={styles.card}>
              <div style={styles.cardTitlu}>Încearcă modelul — mișcă parametrii și vezi predicția</div>
              <div style={styles.estimatorGrid}>
                <div style={styles.controale}>
                  <label style={styles.lbl}>
                    Județ
                    <select
                      style={styles.select}
                      value={judetSel?.nume || ''}
                      onChange={(e) => setJudetSel(judete.find((j) => j.nume === e.target.value))}
                    >
                      {judete.map((j) => <option key={j.id_judet} value={j.nume}>{j.nume}</option>)}
                    </select>
                  </label>
                  <label style={styles.lbl}>
                    Luna: <strong>{LUNI[luna - 1]}</strong>
                    <input type="range" min="1" max="12" value={luna} onChange={(e) => setLuna(Number(e.target.value))} />
                  </label>
                  <label style={styles.lbl}>
                    Temperatură: <strong>{temp} °C</strong>
                    <input type="range" min="-10" max="35" value={temp} onChange={(e) => setTemp(Number(e.target.value))} />
                  </label>
                  <label style={styles.lbl}>
                    Vânt: <strong>{vant.toFixed(1)} m/s</strong>
                    <input type="range" min="0" max="8" step="0.1" value={vant} onChange={(e) => setVant(Number(e.target.value))} />
                  </label>
                </div>
                <div style={styles.rezultatBox}>
                  <div style={styles.rezultatLabel}>GHI estimat</div>
                  <div style={styles.rezultatVal}>{ghiEstimat != null ? ghiEstimat.toFixed(2) : '…'}</div>
                  <div style={styles.rezultatUnit}>kWh/m²/zi</div>
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardTitlu}>Comparație cu baseline-ul sezonier</div>
              <p style={styles.text}>
                MAE model = <strong>{validare.mae.toFixed(3)}</strong> vs. baseline „media lunii" = <strong>{validare.mae_baseline_sezonier.toFixed(3)}</strong>
                {' '}→ modelul e de <strong>{imbunatatire.toFixed(1)}×</strong> mai precis. Antrenat pe {validare.n_total} înregistrări, testat pe {validare.n_test}.
              </p>
            </div>
          </>
        )}

        {clustere.length > 0 && (
          <>
            <div style={styles.sectiune}>2. Clasificarea județelor — K-means</div>
            <div style={styles.card}>
              <div style={styles.cardTitlu}>Județele după potențial (radiație vs. vânt)</div>
              <ResponsiveContainer width="100%" height={340}>
                <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    type="number" dataKey="ghi_mediu" name="GHI" domain={['auto', 'auto']} tick={{ fontSize: 11 }}
                    label={{ value: 'GHI (kWh/m²/zi)', position: 'insideBottom', offset: -12, fontSize: 12 }}
                  />
                  <YAxis
                    type="number" dataKey="vant_mediu" name="Vânt" domain={['auto', 'auto']} tick={{ fontSize: 11 }}
                    label={{ value: 'Vânt (m/s)', angle: -90, position: 'insideLeft', fontSize: 12 }}
                  />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v, n) => [typeof v === 'number' ? v.toFixed(2) : v, n]} />
                  <Scatter data={clustere}>
                    {clustere.map((c, i) => <Cell key={i} fill={CULORI_CLASE[c.cluster]} />)}
                    <LabelList dataKey="nume" position="top" style={{ fontSize: 11, fill: '#444' }} />
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              <div style={styles.legenda}>
                {ETICHETE_CLASE.map((et, i) => (
                  <span key={i} style={styles.legItem}>
                    <span style={{ ...styles.dot, background: CULORI_CLASE[i] }} />{et}
                  </span>
                ))}
              </div>
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
  cardTitlu: { fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '14px' },
  text: { fontSize: '13px', color: '#444', lineHeight: '1.7', margin: 0 },
  estimatorGrid: { display: 'grid', gridTemplateColumns: '1fr 180px', gap: '20px', alignItems: 'center' },
  controale: { display: 'flex', flexDirection: 'column', gap: '14px' },
  lbl: { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#666' },
  select: { padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #E0DDD6', background: '#F5F3EE', fontSize: '13px' },
  rezultatBox: { background: '#E1F5EE', borderRadius: '12px', padding: '20px', textAlign: 'center' },
  rezultatLabel: { fontSize: '12px', color: '#0F6E56', marginBottom: '6px' },
  rezultatVal: { fontSize: '34px', fontWeight: '700', color: '#0F6E56', lineHeight: 1 },
  rezultatUnit: { fontSize: '11px', color: '#0F6E56', marginTop: '6px' },
  legenda: { display: 'flex', gap: '18px', justifyContent: 'center', marginTop: '10px' },
  legItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#666' },
  dot: { width: '12px', height: '12px', borderRadius: '3px', display: 'inline-block' },
  eroare: { color: '#b91c1c', fontWeight: 600 },
  loading: { color: '#888' },
}
