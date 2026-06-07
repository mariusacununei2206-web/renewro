import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { getJudete, getSimulare } from '../services/api.js'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'

// Indicatorii comparati (maiMare = valoarea mare e mai buna)
const RANDURI = [
  { label: 'Energie (kWh/an)', get: (r) => r.energie_anuala, fmt: (v) => Math.round(v).toLocaleString('ro-RO'), maiMare: true },
  { label: 'NPV (lei)', get: (r) => r.economic.npv, fmt: (v) => Math.round(v).toLocaleString('ro-RO'), maiMare: true },
  { label: 'IRR (%)', get: (r) => r.economic.irr * 100, fmt: (v) => v.toFixed(1), maiMare: true },
  { label: 'LCOE (lei/kWh)', get: (r) => r.economic.lcoe, fmt: (v) => v.toFixed(3), maiMare: false },
  { label: 'Payback (ani)', get: (r) => r.economic.payback_simplu, fmt: (v) => v.toFixed(1), maiMare: false },
  { label: 'CO₂ evitat (kg/an)', get: (r) => r.economic.co2_evitat_anual, fmt: (v) => Math.round(v).toLocaleString('ro-RO'), maiMare: true },
]

export default function Comparatii() {
  const [judete, setJudete] = useState([])
  const [judet, setJudet] = useState('')
  const [putereKwp, setPutereKwp] = useState(5)
  const [autoconsum, setAutoconsum] = useState(0.4)
  const [subventie, setSubventie] = useState(true)
  const [scenarii, setScenarii] = useState([])
  const [seIncarca, setSeIncarca] = useState(false)

  useEffect(() => {
    getJudete()
      .then((l) => { setJudete(l); if (l.length) setJudet(l[0].nume) })
      .catch((e) => console.error(e))
  }, [])

  // Adauga un scenariu (cheama /simulare si retine rezultatul)
  async function adauga() {
    if (scenarii.length >= 4) return
    setSeIncarca(true)
    try {
      const rez = await getSimulare(judet, putereKwp, autoconsum, subventie)
      const eticheta = `${judet} · ${putereKwp}kWp · ${Math.round(autoconsum * 100)}%${subventie ? ' · subv' : ''}`
      setScenarii((prev) => [...prev, { id: Date.now() + Math.random(), eticheta, rez }])
    } catch (e) {
      console.error(e)
    } finally {
      setSeIncarca(false)
    }
  }

  function sterge(id) {
    setScenarii((prev) => prev.filter((s) => s.id !== id))
  }

  // Index-ul scenariului cu cea mai buna valoare pe un rand
  function indexBest(rand) {
    if (scenarii.length < 2) return -1
    const valori = scenarii.map((s) => rand.get(s.rez))
    let best = 0
    valori.forEach((v, i) => { if (rand.maiMare ? v > valori[best] : v < valori[best]) best = i })
    return best
  }

  const dateGrafic = scenarii.map((s) => ({ nume: s.eticheta, npv: Math.round(s.rez.economic.npv) }))

  return (
    <Layout>
      <div style={styles.pagina}>
        <div style={styles.header}>
          <h1 style={styles.titlu}>Comparații investiții</h1>
          <p style={styles.subtitlu}>Adaugă 2–4 scenarii și vezi care e cea mai bună opțiune</p>
        </div>

        <div style={styles.formCard}>
          <select style={styles.select} value={judet} onChange={(e) => setJudet(e.target.value)}>
            {judete.map((j) => <option key={j.id_judet} value={j.nume}>{j.nume}</option>)}
          </select>
          <label style={styles.miniLabel}>
            Putere: <strong>{putereKwp} kWp</strong>
            <input type="range" min="1" max="20" step="0.5" value={putereKwp} onChange={(e) => setPutereKwp(Number(e.target.value))} />
          </label>
          <label style={styles.miniLabel}>
            Autoconsum: <strong>{Math.round(autoconsum * 100)}%</strong>
            <input type="range" min="0" max="1" step="0.05" value={autoconsum} onChange={(e) => setAutoconsum(Number(e.target.value))} />
          </label>
          <label style={styles.checkLabel}>
            <input type="checkbox" checked={subventie} onChange={(e) => setSubventie(e.target.checked)} /> Subvenție
          </label>
          <button style={styles.btn} onClick={adauga} disabled={seIncarca || scenarii.length >= 4}>
            {seIncarca ? '…' : (scenarii.length >= 4 ? 'Maxim 4' : '+ Adaugă')}
          </button>
        </div>

        {scenarii.length === 0 ? (
          <div style={styles.gol}>Niciun scenariu încă. Configurează unul mai sus și apasă „+ Adaugă".</div>
        ) : (
          <>
            <div style={styles.card}>
              <table style={styles.tabel}>
                <thead>
                  <tr>
                    <th style={styles.thLabel}></th>
                    {scenarii.map((s) => (
                      <th key={s.id} style={styles.th}>
                        {s.eticheta} <span style={styles.x} onClick={() => sterge(s.id)}>✕</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RANDURI.map((rand) => {
                    const best = indexBest(rand)
                    return (
                      <tr key={rand.label}>
                        <td style={styles.tdLabel}>{rand.label}</td>
                        {scenarii.map((s, i) => (
                          <td key={s.id} style={{ ...styles.td, ...(i === best ? styles.tdBest : {}) }}>
                            {rand.fmt(rand.get(s.rez))}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={styles.card}>
              <div style={styles.cardTitlu}>NPV comparativ (lei)</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dateGrafic}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="nume" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [`${v.toLocaleString('ro-RO')} lei`, 'NPV']} />
                  <Bar dataKey="npv" fill="#1D9E75" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}

const styles = {
  pagina: { padding: '28px 32px', maxWidth: '1100px' },
  header: { marginBottom: '20px' },
  titlu: { fontSize: '24px', fontWeight: 600, color: '#1a1a1a', marginBottom: 4 },
  subtitlu: { fontSize: 14, color: '#888' },
  formCard: { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' },
  select: { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E0DDD6', background: '#F5F3EE', fontSize: 13 },
  miniLabel: { display: 'flex', flexDirection: 'column', fontSize: 12, color: '#666', gap: 4, minWidth: 150 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666', cursor: 'pointer' },
  btn: { padding: '10px 18px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  gol: { background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  card: { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 },
  cardTitlu: { fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 16 },
  tabel: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thLabel: { textAlign: 'left', padding: 10 },
  th: { textAlign: 'center', padding: 10, color: '#1a1a1a', fontSize: 12, borderBottom: '2px solid #1D9E75' },
  x: { color: '#C0392B', cursor: 'pointer', marginLeft: 6, fontSize: 11 },
  tdLabel: { padding: 10, color: '#666', borderBottom: '0.5px solid #f0f0f0' },
  td: { padding: 10, textAlign: 'center', borderBottom: '0.5px solid #f0f0f0', color: '#1a1a1a' },
  tdBest: { background: '#E1F5EE', color: '#0F6E56', fontWeight: 700 },
}
