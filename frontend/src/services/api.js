// URL-ul backend-ului FastAPI
const API_URL = 'http://127.0.0.1:8000'

// Helper: GET cu parametri, intoarce JSON (sau arunca eroare cu mesaj)
async function getJSON(cale, parametri = {}) {
  const query = new URLSearchParams(parametri).toString()
  const url = query ? `${API_URL}${cale}?${query}` : `${API_URL}${cale}`
  const raspuns = await fetch(url)
  if (!raspuns.ok) {
    const eroare = await raspuns.json().catch(() => ({}))
    throw new Error(eroare.detail || `Eroare ${raspuns.status}`)
  }
  return raspuns.json()
}

// Lista celor 8 judete
export const getJudete = () => getJSON('/judete')

// Simulare completa pentru un judet
export const getSimulare = (judet, putere_kwp, autoconsum, subventie = true) =>
  getJSON('/simulare', { judet, putere_kwp, autoconsum, subventie })

// Comparatie solar vs eolian
export const getComparatie = (judet, putere_kwp) =>
  getJSON('/comparatie', { judet, putere_kwp })

// Machine Learning
export const getValidareML = () => getJSON('/ml/validare')
export const getClustereML = (n = 3) => getJSON('/ml/clustere', { n })
export const getEstimareML = (lat, lon, luna) => getJSON('/ml/estimare', { lat, lon, luna })
