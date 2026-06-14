const API_URL = 'http://127.0.0.1:8000'

// Header de autentificare (daca exista token salvat)
function authHeader() {
  const t = localStorage.getItem('token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

// GET cu parametri (+ token), intoarce JSON
async function getJSON(cale, parametri = {}) {
  const query = new URLSearchParams(parametri).toString()
  const url = query ? `${API_URL}${cale}?${query}` : `${API_URL}${cale}`
  const raspuns = await fetch(url, { headers: { ...authHeader() } })
  if (!raspuns.ok) {
    const eroare = await raspuns.json().catch(() => ({}))
    throw new Error(eroare.detail || `Eroare ${raspuns.status}`)
  }
  return raspuns.json()
}

// POST cu corp JSON (+ token)
async function postJSON(cale, body) {
  const raspuns = await fetch(`${API_URL}${cale}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
  })
  if (!raspuns.ok) {
    const eroare = await raspuns.json().catch(() => ({}))
    throw new Error(eroare.detail || `Eroare ${raspuns.status}`)
  }
  return raspuns.json()
}

// ---- Simulare ----
export const getJudete = () => getJSON('/judete')
export const getSimulare = (judet, putere_kwp, autoconsum, subventie = true) =>
  getJSON('/simulare', { judet, putere_kwp, autoconsum, subventie })
export const getComparatie = (judet, putere_kwp) =>
  getJSON('/comparatie', { judet, putere_kwp })

// ---- Machine Learning ----
export const getValidareML = () => getJSON('/ml/validare')
export const getClustereML = (n = 3) => getJSON('/ml/clustere', { n })
export const getEstimareML = (lat, lon, luna, temperatura, viteza_vant) =>
  getJSON('/ml/estimare', { lat, lon, luna, temperatura, viteza_vant })

// ---- Autentificare ----
export const register = (email, parola, nume) =>
  postJSON('/register', { email, parola, nume })

export async function login(email, parola) {
  const body = new URLSearchParams({ username: email, password: parola })
  const raspuns = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!raspuns.ok) {
    const eroare = await raspuns.json().catch(() => ({}))
    throw new Error(eroare.detail || 'Autentificare eșuată')
  }
  return raspuns.json()
}

export const getProfil = () => getJSON('/profil')
export const getSimulari = () => getJSON('/simulari')
export const salveazaSimulare = (judet, putere_kwp, autoconsum, subventie = true) =>
  postJSON('/simulari', { judet, putere_kwp, autoconsum, subventie })
export const getSimularePrincipala = () => getJSON('/simulari/principala')
export const seteazaPrincipala = (id) => postJSON(`/simulari/${id}/principala`, {})
