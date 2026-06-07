import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { getSimulare } from '../services/api.js'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const LUNI = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun',
              'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec']

export default function Dashboard() {
  const [r, setR] = useState(null)
  const [loading, setLoading] = useState(true)

  // La pornire: o simulare implicita (Iasi, 5 kWp, autoconsum 40%)
  useEffect(() => {
    getSimulare('Iasi', 5, 0.4)
      .then(setR)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false))
  }, [])

  const ora = new Date().getHours()
  const salut = ora < 12 ? 'Bună dimineața' : ora < 18 ? 'Bună ziua' : 'Bună seara'

  const dateGrafic = r
    ? Object.entries(r.productie_lunara).map(([l, k]) => ({
        luna: LUNI[Number(l) - 1], valoare: Math.round(k),
      }))
    : []

  const copaci = r ? Math.round(r.economic.co2_evitat_anual / 21) : 0

  return (
    <Layout>
      <div style={styles.pagina}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.titlu}>{salut}!</h1>
            <p style={styles.subtitlu}>Situația pentru un sistem de 5 kWp în Iași</p>
          </div>
          <div style={styles.dataAzi}>
            {new Date().toLocaleDateString('ro-RO', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </div>
        </div>

        <div style={styles.kpiGrid}>
          <Kpi label="Beneficiu anual" val={r ? `${Math.round(r.economic.beneficiu_anual)} lei` : '…'} sub="factură evitată + injecție" />
          <Kpi label="Producție anuală" val={r ? `${Math.round(r.energie_anuala)} kWh` : '…'} sub="an tipic" />
          <Kpi label="Impact CO₂" val={`${copaci} copaci`} sub="echivalent plantat / an" />
        </div>

        <div style={styles.row2}>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Producție lunară — Iași (kWh)</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dateGrafic}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="luna" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v} kWh`, 'Producție']} />
                <Bar dataKey="valoare" fill="#1D9E75" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={styles.card}>
            <div style={styles.cardTitle}>Date meteo medii — Iași (2005–2025)</div>
            {loading ? (
              <div style={styles.loading}>Se încarcă datele…</div>
            ) : r ? (
              <div style={styles.meteoList}>
                <Row label="☀️ Radiație solară (GHI)" val={`${r.meteo.ghi.toFixed(2)} kWh/m²/zi`} />
                <Row label="🌡️ Temperatură medie" val={`${r.meteo.temperatura.toFixed(1)} °C`} />
                <Row label="💨 Viteza vântului" val={`${r.meteo.viteza_vant.toFixed(2)} m/s`} />
                <Row label="📅 Orizont analiză" val={`${r.durata_viata} ani`} />
              </div>
            ) : (
              <div style={styles.loading}>Nu s-au putut încărca datele (e pornit backend-ul?).</div>
            )}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Recomandarea zilei</div>
          <div style={styles.recBox}>
            {r
              ? `Iașiul are un potențial solar de ${r.meteo.ghi.toFixed(2)} kWh/m²/zi. Un sistem de 5 kWp produce ~${Math.round(r.energie_anuala)} kWh/an, cu un NPV de ${Math.round(r.economic.npv).toLocaleString('ro-RO')} lei pe ${r.durata_viata} ani. Lunile mai–august sunt optime; orientare sud, înclinare ~35°.`
              : 'Se încarcă recomandarea…'}
          </div>
        </div>
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

function Row({ label, val }) {
  return (
    <div style={styles.meteoRow}>
      <span style={styles.meteoLabel}>{label}</span>
      <span style={styles.meteoVal}>{val}</span>
    </div>
  )
}

const styles = {
  pagina: { padding: '28px 32px', maxWidth: '1200px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  titlu: { fontSize: '24px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' },
  subtitlu: { fontSize: '14px', color: '#888' },
  dataAzi: { fontSize: '13px', color: '#888', textTransform: 'capitalize' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' },
  kpiCard: { background: '#1D9E75', borderRadius: '12px', padding: '20px', color: '#fff' },
  kpiLabel: { fontSize: '12px', opacity: 0.85, marginBottom: '8px' },
  kpiVal: { fontSize: '26px', fontWeight: '600', marginBottom: '4px' },
  kpiSub: { fontSize: '11px', opacity: 0.7 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
  card: { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '16px' },
  cardTitle: { fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '16px' },
  meteoList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  meteoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '8px 0', borderBottom: '0.5px solid #f0f0f0' },
  meteoLabel: { color: '#666' },
  meteoVal: { fontWeight: '500', color: '#1D9E75' },
  recBox: { background: '#E1F5EE', borderRadius: '8px', padding: '14px', fontSize: '13px', color: '#085041', lineHeight: '1.6' },
  loading: { color: '#888', fontSize: '13px', padding: '20px 0', textAlign: 'center' },
}
