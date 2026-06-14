import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout.jsx'
import { getJudete, getComparatie } from '../services/api.js'
import * as d3 from 'd3'
import { IconSoare, IconVant } from '../components/Icoane.jsx'

const TIPURI = [
  { key: 'solar_kwh', label: 'Solar', Icon: IconSoare, unitate: 'kWh/an' },
  { key: 'eolian_kwh', label: 'Eolian', Icon: IconVant, unitate: 'kWh/an' },
]

// Culoare in functie de pozitia valorii intre min si max
function culoare(val, min, max) {
  if (val == null) return '#E1F5EE'
  const t = max > min ? (val - min) / (max - min) : 0.5
  if (t > 0.66) return '#0F6E56'
  if (t > 0.33) return '#1D9E75'
  return '#5DCAA5'
}

export default function Harta() {
  const svgRef = useRef(null)
  const [date, setDate] = useState(null)        // { Iasi: {solar_kwh, eolian_kwh}, ... }
  const [tip, setTip] = useState('solar_kwh')
  const [selectat, setSelectat] = useState(null)
  const [loading, setLoading] = useState(true)

  // Incarca productia solar/eolian pentru fiecare judet
  useEffect(() => {
    async function incarca() {
      try {
        const judete = await getJudete()
        const rez = await Promise.all(judete.map((j) => getComparatie(j.nume, 5)))
        const dict = {}
        rez.forEach((c) => { dict[c.judet] = { solar_kwh: c.solar_kwh, eolian_kwh: c.eolian_kwh } })
        setDate(dict)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    incarca()
  }, [])

  // Deseneaza harta cu d3 (choropleth)
  useEffect(() => {
    if (!date || !svgRef.current) return
    const width = 500, height = 520
    d3.select(svgRef.current).selectAll('*').remove()
    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', '100%')

    fetch('/romania-judete.geojson')
      .then((res) => res.json())
      .then((geo) => {
        const numeleMele = Object.keys(date)
        const features = geo.features.filter((f) => numeleMele.includes(f.properties.NAME_1))
        const fc = { type: 'FeatureCollection', features }

        const projection = d3.geoMercator().fitSize([width, height], fc)
        const path = d3.geoPath().projection(projection)
        const valori = numeleMele.map((n) => date[n][tip])
        const min = Math.min(...valori), max = Math.max(...valori)

        svg.selectAll('path').data(features).enter().append('path')
          .attr('d', path)
          .attr('fill', (d) => culoare(date[d.properties.NAME_1]?.[tip], min, max))
          .attr('stroke', '#fff').attr('stroke-width', 1.5).style('cursor', 'pointer')
          .on('mouseover', function () { d3.select(this).attr('opacity', 0.8) })
          .on('mouseout', function () { d3.select(this).attr('opacity', 1) })
          .on('click', (e, d) => setSelectat({ nume: d.properties.NAME_1, date: date[d.properties.NAME_1] }))

        svg.selectAll('text').data(features).enter().append('text')
          .attr('x', (d) => path.centroid(d)[0]).attr('y', (d) => path.centroid(d)[1])
          .attr('text-anchor', 'middle').attr('fill', '#fff')
          .attr('font-size', '10').attr('font-weight', '600')
          .style('pointer-events', 'none').text((d) => d.properties.NAME_1)
      })
      .catch((e) => console.error('GeoJSON:', e))
  }, [date, tip])

  const tipInfo = TIPURI.find((t) => t.key === tip)

  return (
    <Layout>
      <div style={styles.pagina}>
        <div style={styles.header}>
          <h1 style={styles.titlu}>Vizualizare hartă</h1>
          <p style={styles.subtitlu}>Potențial energetic — cele 8 județe ale Moldovei (sistem 5 kWp)</p>
        </div>

        <div style={styles.tipBtns}>
          {TIPURI.map((t) => (
            <button key={t.key} onClick={() => setTip(t.key)}
              style={{ ...styles.tipBtn, ...(tip === t.key ? styles.tipBtnActiv : {}) }}>
              <t.Icon /> {t.label}
            </button>
          ))}
        </div>

        <div style={styles.continut}>
          <div style={styles.hartaCard}>
            {loading ? <div style={styles.loading}>Se încarcă datele…</div> : <svg ref={svgRef} style={styles.svg} />}
          </div>

          <div style={styles.panel}>
            <div style={styles.card}>
              <div style={styles.cardTitlu}>{selectat ? selectat.nume : 'Informații județ'}</div>
              {selectat?.date ? (
                <div style={styles.infoList}>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}><IconSoare /> Producție solară</span>
                    <span style={styles.infoVal}>{Math.round(selectat.date.solar_kwh).toLocaleString('ro-RO')} kWh/an</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}><IconVant /> Producție eoliană</span>
                    <span style={styles.infoVal}>{Math.round(selectat.date.eolian_kwh).toLocaleString('ro-RO')} kWh/an</span>
                  </div>
                </div>
              ) : (
                <div style={styles.placeholder}>Click pe un județ pentru detalii</div>
              )}
            </div>

            <div style={styles.card}>
              <div style={styles.cardTitlu}>Legendă — {tipInfo?.label}</div>
              {[
                { color: '#0F6E56', label: 'Potențial ridicat' },
                { color: '#1D9E75', label: 'Potențial mediu' },
                { color: '#5DCAA5', label: 'Potențial scăzut' },
              ].map((item) => (
                <div key={item.color} style={styles.legendaItem}>
                  <div style={{ ...styles.legendaDot, background: item.color }} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            {date && (
              <div style={styles.card}>
                <div style={styles.cardTitlu}>Clasament județe</div>
                {Object.entries(date)
                  .sort((a, b) => b[1][tip] - a[1][tip])
                  .map(([judet, d], i) => (
                    <div key={judet} style={styles.clasamentRow}>
                      <span style={styles.nr}>{i + 1}</span>
                      <span style={styles.clasamentJudet}>{judet}</span>
                      <span style={styles.clasamentVal}>{Math.round(d[tip]).toLocaleString('ro-RO')}</span>
                    </div>
                  ))}
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
  header: { marginBottom: '20px' },
  titlu: { fontSize: '24px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' },
  subtitlu: { fontSize: '14px', color: '#888' },
  tipBtns: { display: 'flex', gap: '10px', marginBottom: '16px' },
  tipBtn: { padding: '8px 20px', borderRadius: '20px', border: '1.5px solid #1D9E75', background: '#fff', color: '#1D9E75', fontSize: '13px', cursor: 'pointer' },
  tipBtnActiv: { background: '#1D9E75', color: '#fff' },
  continut: { display: 'grid', gridTemplateColumns: '1fr 260px', gap: '16px' },
  hartaCard: { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  svg: { width: '100%', height: 'auto' },
  loading: { color: '#888', fontSize: '13px' },
  panel: { display: 'flex', flexDirection: 'column', gap: '12px' },
  card: { background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  cardTitlu: { fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '12px' },
  infoList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  infoRow: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: '0.5px solid #f0f0f0' },
  infoLabel: { color: '#666' },
  infoVal: { color: '#1D9E75', fontWeight: '500' },
  placeholder: { fontSize: '12px', color: '#aaa', textAlign: 'center', padding: '16px 0' },
  legendaItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#666', marginBottom: '6px' },
  legendaDot: { width: '12px', height: '12px', borderRadius: '3px' },
  clasamentRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '0.5px solid #f0f0f0', fontSize: '12px' },
  nr: { width: '18px', height: '18px', background: '#1D9E75', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 },
  clasamentJudet: { flex: 1, color: '#444' },
  clasamentVal: { color: '#1D9E75', fontWeight: '500' },
}
