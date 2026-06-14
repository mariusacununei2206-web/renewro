# Documentația aplicației RenewRO

Acest document explică **tot codul** aplicației, clar și pe înțeles, fișier cu fișier,
cu formulele și logica din spate. E gândit ca să poți **înțelege și apăra fiecare decizie**.

---

## Cuprins
1. [Ce este RenewRO](#1-ce-este-renewro)
2. [Arhitectura pe straturi](#2-arhitectura-pe-straturi)
3. [Tehnologii și biblioteci](#3-tehnologii-și-biblioteci)
4. [Stratul de date (`baza_date/`)](#4-stratul-de-date-baza_date)
5. [Backend — logica de domeniu (`backend/`)](#5-backend--logica-de-domeniu)
6. [Machine Learning (`model_ml.py`)](#6-machine-learning)
7. [Autentificare](#7-autentificare)
8. [API HTTP (`api.py`)](#8-api-http)
9. [Frontend React (`frontend/`)](#9-frontend-react)
10. [Validare PVGIS](#10-validare-pvgis)
11. [Fluxuri complete](#11-fluxuri-complete)
12. [Glosar de concepte](#12-glosar-de-concepte)
13. [Cum se rulează](#13-cum-se-rulează)

---

## 1. Ce este RenewRO

RenewRO este un **sistem de suport decizional (DSS)** pentru investiții în energie regenerabilă
în cele **8 județe ale regiunii Moldova** (NE României). Pe baza datelor meteo istorice
(NASA POWER, 2005–2025), estimează producția fotovoltaică și o transformă în **indicatori de
rentabilitate** (NPV, IRR, LCOE, payback), răspunzând la întrebarea: *„dacă investesc X în zona Y,
ce randament am?"*.

Pe lângă simulare, aplicația are: comparație de scenarii, hartă a potențialului, un model de
**machine learning** (estimare radiație + clasificare județe), autentificare cu profil, și
validare independentă față de **PVGIS**.

---

## 2. Arhitectura pe straturi

Aplicația are **3 straturi decuplate**, care comunică doar prin granițe clare:

```
┌─────────────────────────┐   HTTP (JSON)   ┌──────────────────────────┐   SQL   ┌──────────────┐
│   FRONTEND (React/Vite)  │ ◄────────────►  │   BACKEND (Python/FastAPI)│ ◄────► │  PostgreSQL  │
│   pagini + grafice       │                 │   modele + economie + ML  │         │  3+2 tabele  │
└─────────────────────────┘                 └──────────────────────────┘         └──────────────┘
```

- **Frontend** ↔ **Backend**: prin HTTP (cereri `fetch` către API).
- **Backend** ↔ **Bază de date**: prin conexiunea PostgreSQL (`psycopg2`).

Beneficiul decuplării: fiecare strat poate fi dezvoltat, testat și rulat separat (de aceea stau
chiar în IDE-uri diferite). Logica de business e **pură** (nu atinge baza de date direct), deci
testabilă fără PostgreSQL.

**Lanțul valorii** (de la date la decizie):
```
GHI (kWh/m²)  →  Model producție  →  energie (kWh/an)  →  Motor economic  →  bani (NPV, lei)
                                                          → Analiză risc → incertitudine (P50/P90)
```

---

## 3. Tehnologii și biblioteci

| Tehnologie / bibliotecă | Unde | Rol |
|---|---|---|
| **Python 3.11** | backend, baza_date | limbajul backend-ului |
| **PostgreSQL** + `psycopg2-binary` | bază de date | stocarea datelor; driver-ul de conectare |
| **FastAPI** + `uvicorn` | backend | framework-ul API + serverul care îl rulează |
| **scikit-learn** + `numpy` | backend | machine learning (Random Forest, K-means) |
| **bcrypt** + `python-jose` | backend | criptarea parolelor + token-uri JWT |
| **python-dotenv** | tot | citirea credențialelor din `.env` |
| **requests** | baza_date | descărcarea datelor de la NASA POWER |
| **React 19** + **Vite** | frontend | biblioteca de interfață + unealta de build |
| **react-router-dom** | frontend | navigarea între pagini |
| **Recharts** | frontend | graficele (bare, linie, scatter) |
| **d3** | frontend | harta choropleth a Moldovei |
| **NASA POWER** (API) | date | sursa datelor meteo istorice |
| **PVGIS** (API) | validare | referință independentă pentru producție |
| **Open-Meteo** (API) | frontend | vremea de azi (widget sidebar) |

---

## 4. Stratul de date (`baza_date/`)

Acest strat se rulează **o singură dată**, la instalare: creează tabelele și aduce datele de la NASA.
La runtime, aplicația **nu** mai atinge NASA — citește doar din PostgreSQL.

### `creare_baza_date.py` — clasa `CreatorBazaDate`
Creează schema (5 tabele) și o populează cu datele de referință.

- **`SQL_SCHEMA`** — un șir cu `CREATE TABLE IF NOT EXISTS` pentru:
  - `judete` (id, nume unic, latitudine, longitudine),
  - `date_meteo` (id_judet→judete, an, luna, ghi, temperatura, viteza_vant; unic pe (judet,an,luna)),
  - `parametri_economici` (denumire unică, valoare, unitate),
  - `utilizatori` (email unic, parola_hash, nume),
  - `simulari_salvate` (id_utilizator→utilizatori, judet, putere, autoconsum, npv, rezultat JSONB, principala).
- **`JUDETE`** — lista celor 8 județe cu coordonatele reședinței (fără diacritice: „Iasi", „Bacau"…).
- **`PARAMETRI`** — 8 parametri economici (preț retail 1.30, preț injecție 0.50, rată scont 0.08,
  performance_ratio 0.80, durata 25 ani, factor CO₂ 0.30, cost 5000 lei/kWp, subvenție Casa Verde 20000).
- **Metode:** `creeaza_tabele()`, `populeaza_judete()`, `populeaza_parametri()`, `ruleaza_tot()`.

**Principii (de apărat):**
- **Idempotență:** `CREATE TABLE IF NOT EXISTS` + `INSERT ... ON CONFLICT DO NOTHING` → re-rularea
  nu strică și nu dublează nimic.
- **SQL parametrizat:** mereu `%s` + tuplu de parametri (anti SQL-injection), niciodată f-string cu valori.
- **`NUMERIC`, nu `FLOAT`:** valori exacte în bază; convertite la `float` doar la citire.

### `colector_date.py` — clasa `ColectorDate`
Descarcă seria lunară 2005–2025 de la NASA POWER pentru fiecare județ și umple `date_meteo`.

- `_construieste_url(lat, lon)` — formează URL-ul API (parametri în engleză: `latitude`, `longitude`,
  `start`, `end` — îi cere API-ul). Variabile: GHI (`ALLSKY_SFC_SW_DWN`), temperatură (`T2M`), vânt (`WS10M`).
- `_descarca(...)` — `requests.get` + `raise_for_status`.
- `_parseaza(json)` — transformă răspunsul în rânduri. **Două capcane tratate aici:**
  - **`if luna == 13: continue`** — luna 13 din răspuns e media anuală, nu o lună reală → de sărit
    (altfel dublezi datele).
  - **filtrare `-999`** — NASA marchează valorile lipsă cu `-999` (nu `null`) → de eliminat (altfel
    „otrăvesc" mediile).
- `_scrie_in_baza(...)` — `executemany` cu `ON CONFLICT DO NOTHING`.
- `colecteaza_tot()` — iterează județele, descarcă, parsează, scrie, cu `time.sleep(1)` (politețe față de API).

---

## 5. Backend — logica de domeniu

Toate clasele de aici primesc dependențele din afară (**dependency injection**) și sunt **pure**
(nu se conectează singure la baza de date) → testabile fără PostgreSQL.

### `repozitoriu_date.py` — clasa `RepozitoriuDate`
Singurul „cititor" din PostgreSQL la runtime. Primește `conexiune` în `__init__`.
- `get_toate_judetele()` → listă de dicturi {id, nume, lat, lon}.
- `get_judet_dupa_nume(nume)` → un județ sau `None`.
- `get_date_meteo(id_judet)` → seria lunară (listă de dicturi).
- `get_parametri_economici()` → dict {denumire: valoare}.

### `modele_productie.py` — modelele de producție
Constante fizice: `G_REF = 1.0` kW/m² (referință STC), `RHO = 1.225` kg/m³ (densitatea aerului),
`BETZ = 0.593` (limita Betz), `ZILE_LUNA` (zile/lună).

- **`ModelProductie` (abstract)** — contractul comun:
  - `_medie_lunara(date, camp)` (static) — media multianuală a unui câmp, pe fiecare lună
    (comprimă cei 21 de ani într-un „an tipic").
  - `productie_lunara(date)` — **abstract** (fiecare model îl implementează).
  - `productie_anuala(date)` — suma celor 12 luni (la fel pentru orice tehnologie — Template Method).
- **`ModelProductieSolar`** — formula: **`E_lună = P_instalat × (H_plan / G_ref) × PR`**
  - `H_plan` = media zilnică GHI × zilele lunii (capcana de unități: `ALLSKY_SFC_SW_DWN` e medie
    *zilnică* kWh/m²/zi, nu totalul lunii → înmulțire cu zilele aici, nu în colector).
  - `PR` (performance ratio, 0.80) = cât *rămâne* după pierderi (temperatură, invertor, praf).
- **`ModelProductieEolian`** — fizica: **`P = ½·ρ·A·v³·Cp`**
  - `A = π·r²` (aria măturată), `v³` = viteza la cub (de-asta micro-eolianul la 10 m scoate puțin →
    solarul domină), `Cp < 0.593` (Betz).

**De ce clasă abstractă:** cod comun o singură dată (`_medie_lunara`), interfață garantată
(ServiciuSimulare tratează orice model la fel), extensibilitate (poți adăuga hidro fără să atingi
solarul/eolianul) — principiul Open/Closed.

### `motor_economic.py` — clasa `MotorEconomic`
Transformă `kWh/an` în bani. **Agnostic la tehnologie** (primește energie + CAPEX + autoconsum).
Primește `parametri` (dict) prin injecție.

- **`beneficiu_anual(energie, fractie_autoconsum)`** —
  `autoconsumat × preț_retail + injectat × preț_injecție`. **Autoconsumul e variabila cheie**:
  un kWh autoconsumat = factură evitată (~1.30 lei), un kWh injectat = preț producător (~0.50 lei).
- **`npv(...)`** — **`NPV = −CAPEX + Σ beneficiu / (1+r)^an`** (DCF, buclă explicită pe cei 25 de ani).
  Valoarea banilor în timp: un leu peste 10 ani valorează azi mai puțin.
- **`payback_simplu`** = CAPEX / beneficiu (naiv). **`payback_actualizat`** = primul an în care suma
  *actualizată* acoperă CAPEX (mai onest). Ambele ≠ durata de viață (25 ani).
- **`irr(...)`** — rata la care NPV = 0, găsită prin **bisecție** (NPV scade când rata crește →
  înjumătățim intervalul [0%, 100%]). IRR > rata de scont ⇒ investiție bună.
- **`lcoe(energie, capex)`** = CAPEX / energia *actualizată* pe durata de viață (costul real al
  unui kWh produs). Sub prețul rețelei ⇒ autoconsumul e profitabil.
- **`co2_evitat_anual`** = energie × factor_emisie.
- **`calculeaza_tot(...)`** — întoarce toți indicatorii într-un dict.

### `analiza_risc.py` — clasa `AnalizaRisc`
Cuantifică incertitudinea. Primește `model` + `motor`.
- `productii_anuale(date)` — rulează modelul pe **fiecare an complet** (12 luni) → distribuție de
  ~21 de valori. (Refolosește `model.productie_anuala` pe felii de date — zero duplicare.)
- `_percentila(valori_sortate, p)` — percentilă cu interpolare liniară (ca `numpy`).
- `scenarii_p50_p90(date)` — **P50** = mediana (an tipic); **P90** = a **10-a** percentilă
  (depășită în 9 ani din 10 — prudent, e ce privește banca); **P10** = a 90-a (optimist).
  *(Capcană: P90 ≠ percentila 90, ci 10!)*
- `npv_p50_p90(...)` — propagă riscul de producție în NPV (optimist vs prudent). NPV@P90 > 0 ⇒ bancabil.
- `senzitivitate_autoconsum(...)` — NPV/IRR la diferite niveluri de autoconsum.

### `serviciu_simulare.py` — clasa `ServiciuSimulare` (dirijorul)
Singura clasă care „știe" cum se leagă toate. Primește `repozitoriu`; citește parametrii o dată.
- `simuleaza(judet, putere, autoconsum, aplica_subventie)` — la un singur apel:
  1. aduce datele (`_adu_judet_si_date`),
  2. construiește lanțul (model solar → motor → risc),
  3. calculează CAPEX efectiv (`capex_brut − subvenție Casa Verde`), energia, producția lunară,
     indicatorii economici, scenariile P50/P90, NPV-urile pe scenarii, senzitivitatea, meteo mediu,
  4. asamblează un **dict `RezultatSimulare`** gata de trimis ca JSON.
- `compara_solar_eolian(...)` — producția ambelor tehnologii în același județ (susține H3).

---

## 6. Machine Learning (`model_ml.py`)

Folosește **scikit-learn**. Două componente:

- **`construieste_set_date(repozitoriu)`** — set de antrenare: caracteristici `(luna, lat, lon,
  temperatura, viteza_vant)` → țintă `ghi`, din toate județele.
- **`EstimatorRadiatie` (supervizat — Random Forest):**
  - `antreneaza(date)` — `RandomForestRegressor` pe tot setul.
  - `estimeaza(luna, lat, lon, temp, vant)` — prezice GHI pentru orice punct/condiții.
  - `valideaza(date)` — **train/test split (80/20)** + **cross-validation (5 felii)** → **R², MAE,
    RMSE, MAPE**, comparat cu un **baseline sezonier** (media lunii). Includerea temperaturii/vântului
    (metodă tip Hargreaves) face modelul să bată baseline-ul.
- **`ClusterizareJudete` (nesupervizat — K-means):**
  - profilul fiecărui județ = (GHI, vânt, temperatură) medii; **standardizare z-score** (ca nicio
    variabilă să nu domine); `KMeans` în K clase; **re-etichetare** după GHI (0 = potențial mic …
    n−1 = mare) pentru interpretabilitate.

**De apărat:** ML-ul estimează *resursa* (radiația), nu „prezice 25 de ani" (cei 25 = orizont
financiar). Validarea cu train/test + cross-validation dovedește că modelul a *învățat*, nu a memorat.

---

## 7. Autentificare

### `autentificare.py`
- `hash_parola(parola)` / `verifica_parola(parola, hash)` — **bcrypt** (salt aleator inclus;
  parola NU se stochează niciodată în clar; hash-ul e ireversibil).
- `creeaza_token(date)` / `decodeaza_token(token)` — **JWT** (`python-jose`), semnat cu un secret,
  cu expirare (24h). Token-ul dovedește identitatea fără a ține sesiuni pe server.

### `repozitoriu_utilizatori.py` — clasa `RepozitoriuUtilizatori`
Acces la `utilizatori` și `simulari_salvate`:
`creeaza_utilizator`, `get_utilizator_dupa_email`, `salveaza_simulare`, `get_simulari`,
`seteaza_principala` (pune `FALSE` pe toate, apoi `TRUE` pe cea aleasă — într-o tranzacție, deci
mereu o singură principală), `get_principala`.

---

## 8. API HTTP (`api.py`)

Strat subțire peste `ServiciuSimulare` — **zero formule aici**, doar primește cereri HTTP și întoarce JSON.

- **CORS** (`CORSMiddleware`) — permite frontend-ului (alt port) să apeleze API-ul.
- **Dependency injection** prin `Depends`: `get_conexiune` (o conexiune per cerere, închisă automat
  cu `yield`/`finally`) → `get_repozitoriu` → `get_serviciu`. La fel `get_repo_utilizatori`.
- **`get_utilizator_curent`** — decodează token-ul (`OAuth2PasswordBearer`), întoarce utilizatorul →
  protejează rutele.
- **`_modul_ml()`** — importă `model_ml` **lazy**; dacă scikit-learn e blocat (Smart App Control),
  doar rutele `/ml/*` eșuează, restul aplicației merge.

**Endpoint-uri:**

| Metodă & rută | Ce face | Protejat |
|---|---|---|
| `GET /` | redirect către `/docs` | nu |
| `GET /sanatate` | verificare că API-ul e viu | nu |
| `GET /judete` | lista celor 8 județe | nu |
| `GET /simulare?judet&putere_kwp&autoconsum&subventie` | simulare completă | nu |
| `GET /comparatie?judet&putere_kwp` | solar vs eolian | nu |
| `GET /ml/estimare?lat&lon&luna&temperatura&viteza_vant` | GHI estimat (RF) | nu |
| `GET /ml/validare` | metrici R²/MAE/MAPE | nu |
| `GET /ml/clustere?n` | clasificarea județelor | nu |
| `POST /register` | cont nou (→ token) | nu |
| `POST /login` | autentificare (→ token) | nu |
| `GET /profil` | datele contului | **da** |
| `GET /simulari` / `POST /simulari` | listează / salvează simulări | **da** |
| `GET /simulari/principala` | simularea principală | **da** |
| `POST /simulari/{id}/principala` | marchează ca principală | **da** |

Validarea intrărilor (Pydantic): `putere_kwp > 0`, `autoconsum ∈ [0,1]` → eroare 422 automată.
Documentație interactivă generată automat la `/docs` (Swagger).

---

## 9. Frontend React (`frontend/`)

Aplicație React (Vite), cu design propriu (sidebar verde #1D9E75, carduri albe, fundal crem #F5F3EE).

**Infrastructură:**
- `main.jsx` — montează `<App/>` în `#root`.
- `App.jsx` — `AuthProvider` (context de auth) + `BrowserRouter` cu rutele; `RutaProtejata`
  redirecționează la `/login` dacă nu ești autentificat (protejează `/profil`).
- `components/Layout.jsx` — sidebar + zona de conținut.
- `components/Sidebar.jsx` — logo, meniul (iconuri SVG), widget-ul de vreme, footer (user/logout sau login).
- `components/WidgetVreme.jsx` — vremea de azi (de la **Open-Meteo**, gratuit), cu selecție de județ;
  cele 8 județe sunt fixe în cod, deci merge independent de backend.
- `components/Icoane.jsx` — iconuri SVG (de meniu = albe; „de conținut" = moștenesc culoarea textului).
- `context/AuthContext.jsx` — ține token-ul (în `localStorage`), expune `login/register/logout` +
  utilizatorul curent. La pornire, dacă există token, încarcă profilul.
- `services/api.js` — un singur loc unde se vorbește cu backend-ul: `getJSON`/`postJSON` (adaugă
  automat header-ul `Authorization` dacă există token) + toate funcțiile (getJudete, getSimulare,
  getComparatie, ML, auth, simulări).

**Pagini:**
- `Dashboard.jsx` (Acasă) — dacă ești logat și ai o **simulare principală**, o afișează (KPI,
  grafic producție lunară, meteo mediu, recomandare); altfel exemplul implicit (Iași 5 kWp).
- `Simulator.jsx` — formular (județ, putere, autoconsum, subvenție) → indicatori (IRR/Payback/NPV) +
  scenarii P90/P50/P10 + grafic de recuperare a investiției + buton „Salvează" (dacă ești logat).
- `Comparatii.jsx` — adaugi 2–4 scenarii și le compari într-un tabel (cu cea mai bună valoare
  evidențiată) + grafic NPV. *Inima unui DSS — compari opțiuni înainte de a decide.*
- `Harta.jsx` — **choropleth d3** al celor 8 județe (GeoJSON local), colorate după producție,
  toggle Solar/Eolian, panou cu info + legendă + clasament.
- `ModelML.jsx` — metrici de validare + **estimator interactiv** (miști sliderele → GHI prezis live)
  + **grafic scatter** al clusterizării.
- `Login.jsx` / `Register.jsx` — autentificare/înregistrare (design propriu).
- `Profil.jsx` — datele contului + simulările salvate, cu buton „Setează ca simulare principală".

**Concept React (de apărat):** „state" = datele care se schimbă; modificarea lor face React să
re-deseneze automat doar ce trebuie. Componentele sunt „controlate" (input-urile sunt legate de state).
Backend ↔ frontend prin `fetch` (recalculare fără reîncărcarea paginii — ipoteza H4).

---

## 10. Validare PVGIS (`validare_pvgis.py`)

Script care testează acuratețea modelului (ipoteza **H1**) față de **PVGIS** (referința Comisiei
Europene, cu altă bază de radiație — SARAH2, satelitară).
- `productie_pvgis(lat, lon)` — cere producția anuală PVGIS (plan orizontal, ca modelul nostru).
- `metrici(model, referinta)` — **MAE, RMSE, MAPE**.
- `__main__` — pentru fiecare județ: producția modelului vs PVGIS → tabel + metrici.

Două surse **independente** (NASA vs PVGIS) care dau aproape aceleași cifre (~1–2%) ⇒ modelul e corect.

---

## 11. Fluxuri complete

**Simulare (Simulator):**
```
alegi județ/putere/autoconsum → fetch GET /simulare → ServiciuSimulare.simuleaza:
  RepozitoriuDate (date) → ModelProductieSolar (energie) → MotorEconomic (NPV/IRR/...) →
  AnalizaRisc (P50/P90) → dict JSON → React desenează indicatorii + graficele
```

**Autentificare + Dashboard personalizat:**
```
Register/Login → token JWT salvat în localStorage → AuthContext setează utilizatorul →
Simulator → „Salvează" (POST /simulari) → Profil → „Setează ca simulare principală"
(POST /simulari/{id}/principala) → Acasă cere GET /simulari/principala → afișează acea simulare
```

**Machine Learning:**
```
ModelML → GET /ml/validare (antrenează RF, train/test + CV → metrici) +
GET /ml/clustere (K-means) ; estimatorul interactiv → GET /ml/estimare la fiecare mișcare de slider
```

---

## 12. Glosar de concepte

- **Dependency Injection (DI):** o clasă primește din afară ce-i trebuie (ex. `conexiune`), nu le
  creează singură → testabilă, fără secrete în cod, o singură conexiune partajată.
- **OOP / clasă abstractă:** `ModelProductie` definește un contract; subclasele implementează fizica
  lor. Cod comun o dată, extensibil fără modificări.
- **DCF / valoarea banilor în timp:** `VP = VF / (1+r)^n`. Banii din viitor valorează azi mai puțin.
- **NPV (VAN):** suma actualizată a beneficiilor minus investiția. NPV > 0 ⇒ proiect rentabil.
- **IRR:** randamentul intern (rata la care NPV = 0). IRR > rata de scont ⇒ investiție bună.
- **LCOE:** costul mediu al unui kWh produs pe toată durata de viață.
- **Payback:** anii până la recuperarea investiției (simplu vs actualizat) — ≠ durata de viață.
- **P50 / P90:** P50 = scenariul tipic (mediana); P90 = scenariul prudent, depășit în 9 ani din 10
  (a 10-a percentilă) — banca se uită la el.
- **R² / MAE / RMSE / MAPE:** măsuri ale acurateței unui model (cât explică / cât de departe sunt
  predicțiile de realitate).
- **Random Forest:** ansamblu de arbori de decizie (supervizat) — învață GHI din caracteristici.
- **K-means:** grupare nesupervizată în K clase după asemănare.
- **Train/test + cross-validation:** antrenezi pe o parte, testezi pe alta nevăzută → dovadă că
  modelul nu a „memorat" (anti-overfitting).
- **JWT:** token semnat care dovedește identitatea (autentificare fără stare).
- **bcrypt:** funcție de hashing pentru parole (ireversibilă, cu salt).
- **CORS:** mecanismul prin care browserul permite cereri între origini diferite (React :5173 → API :8000).
- **REST API / endpoint:** „adrese" HTTP pe care le expune backend-ul; frontend-ul le apelează.
- **GHI:** Global Horizontal Irradiance — radiația solară pe plan orizontal (kWh/m²/zi).

---

## 13. Cum se rulează

Vezi `README.md` pentru pașii completi. Pe scurt:
1. PostgreSQL pornit + baza `renewro` creată.
2. `.env` completat (copiat din `.env.example`).
3. `baza_date/`: `creare_baza_date.py` apoi `colector_date.py` (o singură dată).
4. `backend/`: `uvicorn api:app --reload`.
5. `frontend/`: `npm run dev`.
Backend-ul și frontend-ul rulează **simultan**, în două terminale.
