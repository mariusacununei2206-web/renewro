# RenewRO — Sistem de suport decizional pentru investiții în energie regenerabilă

Aplicație web care estimează producția fotovoltaică în cele **8 județe ale regiunii Moldova**,
pe baza datelor meteo istorice (NASA POWER, 2005–2025), și o transformă în indicatori de
rentabilitate (**NPV, IRR, LCOE, payback**). Include un model de **machine learning**
(Random Forest + K-means), autentificare și validare independentă față de **PVGIS**.

**Autor:** Acununei Marius — lucrare de licență, FEAA, Universitatea „Alexandru Ioan Cuza" din Iași.

---

## Tehnologii
- **Backend:** Python 3.11, FastAPI, PostgreSQL (psycopg2), scikit-learn
- **Frontend:** React (Vite), Recharts, Leaflet, d3
- **Date:** NASA POWER API; validare cu PVGIS

## Structura proiectului
```
RenewRO/
├── baza_date/   # scripturi de creare + colectare a bazei (rulate o singură dată)
├── backend/     # API FastAPI + modele de producție + economie + risc + ML
└── frontend/    # aplicația React
```

## Cerințe
- PostgreSQL (pornit local)
- Python 3.11
- Node.js 18+

---

## Configurare și rulare

### 1. Baza de date
Creează în PostgreSQL o bază goală numită `renewro`.

### 2. Variabile de mediu
Aplicația citește credențialele din variabile de mediu — **nicio parolă nu e în cod**.
Setează-le cu valorile **tale** de PostgreSQL:

| Variabilă | Exemplu |
|---|---|
| `RENEWRO_DB_HOST` | `localhost` |
| `RENEWRO_DB_NAME` | `renewro` |
| `RENEWRO_DB_USER` | `postgres` |
| `RENEWRO_DB_PASSWORD` | *(parola ta de PostgreSQL)* |

În PowerShell (pe sesiunea curentă):
```powershell
$env:RENEWRO_DB_HOST="localhost"; $env:RENEWRO_DB_NAME="renewro"; $env:RENEWRO_DB_USER="postgres"; $env:RENEWRO_DB_PASSWORD="PAROLA_TA"
```

### 3. Stratul de date (se rulează O SINGURĂ DATĂ)
```powershell
cd baza_date
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python creare_baza_date.py   # creează tabelele + datele de referință
.venv\Scripts\python colector_date.py      # descarcă datele meteo de la NASA (~2 min)
```

### 4. Backend (API)
```powershell
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn api:app --reload
```
API la `http://127.0.0.1:8000` · documentație interactivă la `http://127.0.0.1:8000/docs`

### 5. Frontend
```powershell
cd frontend
npm install
npm run dev
```
Aplicația la `http://localhost:5173`

---

## Note
- **Backend-ul și frontend-ul trebuie să ruleze SIMULTAN**, în două terminale separate.
- Pagina „Model ML" necesită `scikit-learn`. Pe Windows cu **Smart App Control** activ,
  acesta poate bloca bibliotecile compilate — dezactivează Smart App Control sau rulează
  pe o mașină fără această restricție.
- Datele meteo provin de la NASA POWER (rezoluție ~50 km, valori lunare).
