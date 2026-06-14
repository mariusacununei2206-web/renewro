import { useState, useEffect } from 'react'

// Cele 8 judete ale Moldovei (coordonate resedinta) - fixe, ca widget-ul sa
// mearga independent de backend (vremea vine de la Open-Meteo, gratuit).
const JUDETE = [
  { nume: 'Bacau', lat: 46.57, lon: 26.91 },
  { nume: 'Botosani', lat: 47.75, lon: 26.67 },
  { nume: 'Galati', lat: 45.44, lon: 28.05 },
  { nume: 'Iasi', lat: 47.16, lon: 27.59 },
  { nume: 'Neamt', lat: 46.93, lon: 26.37 },
  { nume: 'Suceava', lat: 47.65, lon: 26.26 },
  { nume: 'Vaslui', lat: 46.64, lon: 27.73 },
  { nume: 'Vrancea', lat: 45.70, lon: 27.19 },
]

// Traducerea codului meteo WMO (Open-Meteo) in text
const COD_VREME = {
  0: 'Senin', 1: 'Predominant senin', 2: 'Parțial noros', 3: 'Înnorat',
  45: 'Ceață', 48: 'Ceață', 51: 'Burniță', 53: 'Burniță', 55: 'Burniță',
  61: 'Ploaie', 63: 'Ploaie', 65: 'Ploaie torențială',
  71: 'Ninsoare', 73: 'Ninsoare', 75: 'Ninsoare abundentă',
  80: 'Averse', 81: 'Averse', 82: 'Averse puternice',
  95: 'Furtună', 96: 'Furtună cu grindină', 99: 'Furtună cu grindină',
}

export default function WidgetVreme() {
  const [judet, setJudet] = useState(JUDETE.find((j) => j.nume === 'Iasi'))
  const [vreme, setVreme] = useState(null)
  const azi = new Date().toLocaleDateString('ro-RO')

  // Ia vremea de azi pentru judetul selectat (Open-Meteo)
  useEffect(() => {
    let activ = true
    setVreme(null)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${judet.lat}&longitude=${judet.lon}&current=temperature_2m,wind_speed_10m,weather_code&wind_speed_unit=ms`
    fetch(url)
      .then((r) => r.json())
      .then((d) => { if (activ) setVreme(d.current) })
      .catch(() => { if (activ) setVreme(null) })
    return () => { activ = false }
  }, [judet])

  return (
    <div style={styles.box}>
      <div style={styles.titlu}>Vremea astăzi, {azi}</div>
      <select
        style={styles.select}
        value={judet.nume}
        onChange={(e) => setJudet(JUDETE.find((j) => j.nume === e.target.value))}
      >
        {JUDETE.map((j) => <option key={j.nume} value={j.nume}>{j.nume}</option>)}
      </select>
      {vreme ? (
        <div style={styles.continut}>
          <div style={styles.temp}>{Math.round(vreme.temperature_2m)}°</div>
          <div style={styles.detalii}>
            <div>{COD_VREME[vreme.weather_code] || '—'}</div>
            <div>vânt {vreme.wind_speed_10m.toFixed(1)} m/s</div>
          </div>
        </div>
      ) : (
        <div style={styles.incarca}>se încarcă…</div>
      )}
    </div>
  )
}

const styles = {
  box: { margin: '0 12px 12px', padding: '12px', background: 'rgba(255,255,255,0.12)', borderRadius: '10px' },
  titlu: { color: 'rgba(255,255,255,0.9)', fontSize: '12px', fontWeight: 600, marginBottom: '10px' },
  select: { width: '100%', padding: '9px 12px', borderRadius: '8px', border: 'none', fontSize: '13px', background: 'rgba(255,255,255,0.92)', color: '#1a1a1a', marginBottom: '10px', cursor: 'pointer' },
  continut: { display: 'flex', alignItems: 'center', gap: '12px' },
  temp: { color: '#fff', fontSize: '28px', fontWeight: 700, lineHeight: 1 },
  detalii: { color: 'rgba(255,255,255,0.85)', fontSize: '11px', lineHeight: 1.5 },
  incarca: { color: 'rgba(255,255,255,0.7)', fontSize: '12px' },
}
