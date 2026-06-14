import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getJudete, getSimulare, salveazaSimulare } from '../services/api.js'
import { IconSoare, IconTermometru, IconVant, IconBani, IconSalveaza } from '../components/Icoane.jsx'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

export default function Simulator() {
  const [judete, setJudete] = useState([])
  const [judet, setJudet] = useState('Iasi')
  const [putereKwp, setPutereKwp] = useState(5)
  const [autoconsum, setAutoconsum] = useState(0.4)
  const [subventie, setSubventie] = useState(true)
  const [rezultat, setRezultat] = useState(null)
  const [loading, setLoading] = useState(false)
  const [eroare, setEroare] = useState('')
  const [mesajSalvare, setMesajSalvare] = useState('')
  const { utilizator } = useAuth()

  // Incarca lista judetelor
  useEffect(() => {
    getJudete()
      .then((lista) => {
        setJudete(lista)
        if (lista.length > 0) setJudet(lista[0].nume)
      })
      .catch((e) => setEroare(e.message))
  }, [])

  // Cere simularea de la API
  async function calculeaza() {
    setLoading(true)
    setEroare('')
    try {
      const date = await getSimulare(judet, putereKwp, autoconsum, subventie)
      setRezultat(date)
    } catch {
      setEroare('Eroare la calcul. E pornit backend-ul?')
    } finally {
      setLoading(false)
    }
  }

  // Salveaza simularea curenta in profil (necesita autentificare)
  async function salveaza() {
    setMesajSalvare('')
    try {
      await salveazaSimulare(judet, putereKwp, autoconsum, subventie)
      setMesajSalvare('✓ Simulare salvată în profil')
    } catch {
      setMesajSalvare('Eroare la salvare')
    }
  }

  // Flux cumulat pentru graficul de recuperare a investitiei
  const dateGrafic = rezultat
    ? Array.from({ length: rezultat.durata_viata + 1 }, (_, an) => ({
        an: `${an}`,
        cumulat: Math.round(-rezultat.intrari.capex + rezultat.economic.beneficiu_anual * an),
      }))
    : []

  return (
    <Layout>
      <div style={styles.pagina}>
        <div style={styles.header}>
          <h1 style={styles.titlu}>Simulator investiție</h1>
          <p style={styles.subtitlu}>Calculează rentabilitatea unui sistem fotovoltaic</p>
        </div>

        <div style={styles.continut}>
          {/* Formular */}
          <div style={styles.card}>
            <div style={styles.cardTitlu}>Parametri investiție</div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Județ</label>
              <select style={styles.select} value={judet} onChange={(e) => setJudet(e.target.value)}>
                {judete.map((j) => <option key={j.id_judet} value={j.nume}>{j.nume}</option>)}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Putere instalată: <strong>{putereKwp} kWp</strong></label>
              <input type="range" min="1" max="20" step="0.5" style={styles.range}
                value={putereKwp} onChange={(e) => setPutereKwp(Number(e.target.value))} />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Autoconsum: <strong>{Math.round(autoconsum * 100)}%</strong></label>
              <input type="range" min="0" max="1" step="0.05" style={styles.range}
                value={autoconsum} onChange={(e) => setAutoconsum(Number(e.target.value))} />
            </div>

            <div style={styles.formGroup}>
              <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: 0 }}>
                <input type="checkbox" checked={subventie} onChange={(e) => setSubventie(e.target.checked)} />
                Aplică subvenția Casa Verde (−20.000 lei)
              </label>
            </div>

            {eroare && <div style={styles.eroare}>{eroare}</div>}

            <button onClick={calculeaza} style={styles.btnCalcul} disabled={loading}>
              {loading ? 'Se calculează…' : 'Calculează rentabilitatea'}
            </button>
          </div>

          {/* Rezultate */}
          <div style={styles.coloana}>
            {rezultat ? (
              <>
                <div style={styles.kpiGrid}>
                  <div style={styles.kpi}>
                    <div style={styles.kpiLabel}>IRR</div>
                    <div style={styles.kpiVal}>{(rezultat.economic.irr * 100).toFixed(1)}%</div>
                  </div>
                  <div style={styles.kpi}>
                    <div style={styles.kpiLabel}>Payback</div>
                    <div style={styles.kpiVal}>{rezultat.economic.payback_simplu.toFixed(1)} ani</div>
                  </div>
                  <div style={styles.kpi}>
                    <div style={styles.kpiLabel}>NPV ({rezultat.durata_viata} ani)</div>
                    <div style={styles.kpiVal}>
                      {rezultat.economic.npv > 0 ? '+' : ''}{Math.round(rezultat.economic.npv / 1000)}k lei
                    </div>
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardTitlu}>Investiție</div>
                  <div style={styles.meteoGrid}>
                    <div style={styles.meteoItem}>
                      <span style={styles.meteoLabel}>Cost brut (CAPEX)</span>
                      <span style={styles.meteoVal}>{Math.round(rezultat.intrari.capex_brut).toLocaleString('ro-RO')} lei</span>
                    </div>
                    <div style={styles.meteoItem}>
                      <span style={styles.meteoLabel}>Subvenție Casa Verde</span>
                      <span style={styles.meteoVal}>− {Math.round(rezultat.intrari.subventie).toLocaleString('ro-RO')} lei</span>
                    </div>
                    <div style={styles.meteoItem}>
                      <span style={styles.meteoLabel}><strong>Investiție efectivă</strong></span>
                      <span style={styles.meteoVal}><strong>{Math.round(rezultat.intrari.capex).toLocaleString('ro-RO')} lei</strong></span>
                    </div>
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardTitlu}>Producție anuală — scenarii de risc</div>
                  <div style={styles.scenarii}>
                    <div style={styles.scenariu}>
                      <div style={styles.scenariuLabel}>P90 — Prudent</div>
                      <div style={styles.scenariuVal}>{Math.round(rezultat.scenarii_productie.p90).toLocaleString('ro-RO')} kWh</div>
                    </div>
                    <div style={{ ...styles.scenariu, background: '#E1F5EE' }}>
                      <div style={styles.scenariuLabel}>P50 — Tipic</div>
                      <div style={{ ...styles.scenariuVal, color: '#0F6E56' }}>{Math.round(rezultat.scenarii_productie.p50).toLocaleString('ro-RO')} kWh</div>
                    </div>
                    <div style={styles.scenariu}>
                      <div style={styles.scenariuLabel}>P10 — Optimist</div>
                      <div style={styles.scenariuVal}>{Math.round(rezultat.scenarii_productie.p10).toLocaleString('ro-RO')} kWh</div>
                    </div>
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardTitlu}>Recuperarea investiției (flux cumulat, lei)</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={dateGrafic}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="an" tick={{ fontSize: 10 }} interval={4} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(val) => [`${val.toLocaleString('ro-RO')} lei`, 'Cumulat']} />
                      <ReferenceLine y={0} stroke="#e74c3c" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="cumulat" stroke="#1D9E75" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardTitlu}>Date meteo utilizate — {rezultat.judet.nume}</div>
                  <div style={styles.meteoGrid}>
                    <div style={styles.meteoItem}>
                      <span style={styles.meteoLabel}><IconSoare /> Radiație solară</span>
                      <span style={styles.meteoVal}>{rezultat.meteo.ghi.toFixed(2)} kWh/m²/zi</span>
                    </div>
                    <div style={styles.meteoItem}>
                      <span style={styles.meteoLabel}><IconTermometru /> Temperatură medie</span>
                      <span style={styles.meteoVal}>{rezultat.meteo.temperatura.toFixed(1)} °C</span>
                    </div>
                    <div style={styles.meteoItem}>
                      <span style={styles.meteoLabel}><IconVant /> Vânt mediu</span>
                      <span style={styles.meteoVal}>{rezultat.meteo.viteza_vant.toFixed(2)} m/s</span>
                    </div>
                    <div style={styles.meteoItem}>
                      <span style={styles.meteoLabel}><IconBani /> LCOE</span>
                      <span style={styles.meteoVal}>{rezultat.economic.lcoe.toFixed(3)} lei/kWh</span>
                    </div>
                  </div>
                </div>

                <div style={styles.card}>
                  {utilizator ? (
                    <>
                      <button onClick={salveaza} style={styles.btnSalveaza}><IconSalveaza /> Salvează simularea</button>
                      {mesajSalvare && <span style={{ marginLeft: 12, color: '#1D9E75', fontSize: 13 }}>{mesajSalvare}</span>}
                    </>
                  ) : (
                    <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                      <Link to="/login" style={{ color: '#1D9E75', fontWeight: 600 }}>Conectează-te</Link> ca să salvezi simularea în profil.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div style={styles.emptyState}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="#cfd8d3" style={{ marginBottom: '16px' }}>
                  <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" />
                </svg>
                <div style={styles.emptyText}>
                  Alege parametrii și apasă<br /><strong>Calculează rentabilitatea</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

const styles = {
  pagina: { padding: '28px 32px' },
  header: { marginBottom: '24px' },
  titlu: { fontSize: '24px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' },
  subtitlu: { fontSize: '14px', color: '#888' },
  continut: { display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px', alignItems: 'start' },
  card: { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '16px' },
  cardTitlu: { fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '16px' },
  formGroup: { marginBottom: '18px' },
  label: { display: 'block', fontSize: '12px', color: '#666', marginBottom: '8px' },
  select: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #E0DDD6', fontSize: '13px', background: '#F5F3EE' },
  range: { width: '100%' },
  eroare: { background: '#FEECEC', color: '#C0392B', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' },
  btnCalcul: { width: '100%', padding: '12px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginTop: '4px' },
  coloana: { display: 'flex', flexDirection: 'column' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' },
  kpi: { background: '#1D9E75', borderRadius: '12px', padding: '16px', color: '#fff', textAlign: 'center' },
  kpiLabel: { fontSize: '11px', opacity: 0.85, marginBottom: '6px' },
  kpiVal: { fontSize: '22px', fontWeight: '600' },
  scenarii: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
  scenariu: { background: '#F5F3EE', borderRadius: '8px', padding: '12px', textAlign: 'center' },
  scenariuLabel: { fontSize: '11px', color: '#666', marginBottom: '6px' },
  scenariuVal: { fontSize: '14px', fontWeight: '600', color: '#1a1a1a' },
  meteoGrid: { display: 'flex', flexDirection: 'column', gap: '8px' },
  meteoItem: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: '0.5px solid #f0f0f0' },
  meteoLabel: { color: '#666' },
  meteoVal: { color: '#1D9E75', fontWeight: '500' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  emptyIcon: { fontSize: '48px', marginBottom: '16px' },
  emptyText: { fontSize: '14px', color: '#888', textAlign: 'center', lineHeight: '1.6' },
  btnSalveaza: { padding: '10px 18px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
}
