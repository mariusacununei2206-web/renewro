import os
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

# Incarca variabilele de mediu din fisierul .env (radacina proiectului)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from repozitoriu_date import RepozitoriuDate
from serviciu_simulare import ServiciuSimulare
# model_ml (scikit-learn) se importa LAZY in endpoint-uri (vezi _modul_ml),
# ca backend-ul sa porneasca si daca sklearn e blocat de politici de securitate.

from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from jose import JWTError

import autentificare
from repozitoriu_utilizatori import RepozitoriuUtilizatori

# Aplicatia FastAPI
app = FastAPI(
    title="RenewRO API",
    description="Suport decizional pentru investitii in energie regenerabila (Moldova)",
    version="1.0",
)

# CORS: permite frontend-ului React (alt port) sa apeleze API-ul
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # in productie: doar domeniul frontend-ului
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency: o conexiune PostgreSQL per cerere, inchisa automat la final
def get_conexiune():
    conexiune = psycopg2.connect(
        host=os.environ["RENEWRO_DB_HOST"],
        dbname=os.environ["RENEWRO_DB_NAME"],
        user=os.environ["RENEWRO_DB_USER"],
        password=os.environ["RENEWRO_DB_PASSWORD"],
    )
    try:
        yield conexiune
    finally:
        conexiune.close()


# Dependency: repozitoriul peste conexiunea de mai sus
def get_repozitoriu(conexiune=Depends(get_conexiune)):
    return RepozitoriuDate(conexiune)


# Dependency: serviciul de simulare peste repozitoriu
def get_serviciu(repozitoriu=Depends(get_repozitoriu)):
    return ServiciuSimulare(repozitoriu)


# Schema OAuth2 (token in header: Authorization: Bearer ...)
oauth2_schema = OAuth2PasswordBearer(tokenUrl="login")


# Dependency: repozitoriul de utilizatori
def get_repo_utilizatori(conexiune=Depends(get_conexiune)):
    return RepozitoriuUtilizatori(conexiune)


# Dependency: utilizatorul curent (din token) - protejeaza rutele
def get_utilizator_curent(
    token: str = Depends(oauth2_schema),
    repo_u: RepozitoriuUtilizatori = Depends(get_repo_utilizatori),
):
    eroare = HTTPException(
        status_code=401, detail="Token invalid sau expirat",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        date = autentificare.decodeaza_token(token)
        email = date.get("sub")
    except JWTError:
        raise eroare
    if email is None:
        raise eroare
    utilizator = repo_u.get_utilizator_dupa_email(email)
    if utilizator is None:
        raise eroare
    return utilizator


# Pagina principala: redirect catre documentatia interactiva
@app.get("/")
def radacina():
    return RedirectResponse(url="/docs")


# Verificare rapida ca API-ul e viu
@app.get("/sanatate")
def sanatate():
    return {"stare": "ok", "serviciu": "RenewRO API"}


# Lista judetelor (pentru dropdown / harta)
@app.get("/judete")
def judete(repozitoriu: RepozitoriuDate = Depends(get_repozitoriu)):
    return repozitoriu.get_toate_judetele()


# Simulare completa pentru un judet
@app.get("/simulare")
def simulare(
    judet: str = Query(..., description="Numele judetului, ex. Iasi"),
    putere_kwp: float = Query(5.0, gt=0, description="Puterea instalata (kWp)"),
    autoconsum: float = Query(0.4, ge=0, le=1, description="Fractia de autoconsum (0..1)"),
    subventie: bool = Query(True, description="Aplica subventia Casa Verde"),
    serviciu: ServiciuSimulare = Depends(get_serviciu),
):
    try:
        return serviciu.simuleaza(judet, putere_kwp, autoconsum, aplica_subventie=subventie)
    except ValueError as eroare:
        raise HTTPException(status_code=404, detail=str(eroare))


# Comparatie solar vs eolian intr-un judet
@app.get("/comparatie")
def comparatie(
    judet: str = Query(..., description="Numele judetului"),
    putere_kwp: float = Query(5.0, gt=0, description="Puterea instalata (kWp)"),
    serviciu: ServiciuSimulare = Depends(get_serviciu),
):
    try:
        return serviciu.compara_solar_eolian(judet, putere_kwp)
    except ValueError as eroare:
        raise HTTPException(status_code=404, detail=str(eroare))


# Incarca modulul ML lazy; daca sklearn e blocat, doar rutele /ml/* esueaza
def _modul_ml():
    try:
        import model_ml
        return model_ml
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Modulul ML indisponibil (scikit-learn): {e}")


# Estimator ML antrenat o singura data (cache global)
_estimator = None


def _get_estimator(repozitoriu):
    global _estimator
    if _estimator is None:
        ml = _modul_ml()
        _estimator = ml.EstimatorRadiatie().antreneaza(ml.construieste_set_date(repozitoriu))
    return _estimator


# Estimeaza GHI pentru o locatie si o luna (Random Forest)
@app.get("/ml/estimare")
def ml_estimare(
    lat: float = Query(..., description="Latitudine"),
    lon: float = Query(..., description="Longitudine"),
    luna: int = Query(..., ge=1, le=12, description="Luna 1-12"),
    temperatura: float = Query(..., description="Temperatura medie (grade C)"),
    viteza_vant: float = Query(..., description="Viteza vant (m/s)"),
    repozitoriu: RepozitoriuDate = Depends(get_repozitoriu),
):
    est = _get_estimator(repozitoriu)
    return {
        "lat": lat, "lon": lon, "luna": luna,
        "ghi_estimat": est.estimeaza(luna, lat, lon, temperatura, viteza_vant),
    }


# Metricile de validare ale estimatorului (R2/MAE/MAPE + baseline)
@app.get("/ml/validare")
def ml_validare(repozitoriu: RepozitoriuDate = Depends(get_repozitoriu)):
    ml = _modul_ml()
    return ml.EstimatorRadiatie().valideaza(ml.construieste_set_date(repozitoriu))


# Clusterizarea judetelor in clase de potential (K-means)
@app.get("/ml/clustere")
def ml_clustere(
    n: int = Query(3, ge=2, le=5, description="Numar de clase"),
    repozitoriu: RepozitoriuDate = Depends(get_repozitoriu),
):
    ml = _modul_ml()
    profile = ml.construieste_profile_judete(repozitoriu)
    return ml.ClusterizareJudete(n_clustere=n).clusterizeaza(profile)


# ---- Modele de intrare (Pydantic) ----
class Inregistrare(BaseModel):
    email: str
    parola: str
    nume: str | None = None


class SimulareNoua(BaseModel):
    judet: str
    putere_kwp: float = 5.0
    autoconsum: float = 0.4
    subventie: bool = True


# Inregistrare cont nou (intoarce token)
@app.post("/register")
def register(date: Inregistrare, repo_u: RepozitoriuUtilizatori = Depends(get_repo_utilizatori)):
    if repo_u.get_utilizator_dupa_email(date.email):
        raise HTTPException(status_code=400, detail="Email deja inregistrat")
    parola_hash = autentificare.hash_parola(date.parola)
    repo_u.creeaza_utilizator(date.email, parola_hash, date.nume)
    token = autentificare.creeaza_token({"sub": date.email})
    return {"access_token": token, "token_type": "bearer"}


# Autentificare (intoarce token JWT)
@app.post("/login")
def login(
    formular: OAuth2PasswordRequestForm = Depends(),
    repo_u: RepozitoriuUtilizatori = Depends(get_repo_utilizatori),
):
    utilizator = repo_u.get_utilizator_dupa_email(formular.username)
    if utilizator is None or not autentificare.verifica_parola(formular.password, utilizator["parola_hash"]):
        raise HTTPException(status_code=401, detail="Email sau parola gresita")
    token = autentificare.creeaza_token({"sub": utilizator["email"]})
    return {"access_token": token, "token_type": "bearer"}


# Profilul utilizatorului curent (protejat)
@app.get("/profil")
def profil(utilizator=Depends(get_utilizator_curent)):
    return {
        "id_utilizator": utilizator["id_utilizator"],
        "email": utilizator["email"],
        "nume": utilizator["nume"],
    }


# Salveaza o simulare pentru utilizatorul curent (protejat)
@app.post("/simulari")
def salveaza_simulare(
    date: SimulareNoua,
    utilizator=Depends(get_utilizator_curent),
    serviciu: ServiciuSimulare = Depends(get_serviciu),
    repo_u: RepozitoriuUtilizatori = Depends(get_repo_utilizatori),
):
    try:
        rezultat = serviciu.simuleaza(
            date.judet, date.putere_kwp, date.autoconsum, aplica_subventie=date.subventie
        )
    except ValueError as eroare:
        raise HTTPException(status_code=404, detail=str(eroare))
    id_simulare = repo_u.salveaza_simulare(
        utilizator["id_utilizator"], date.judet, date.putere_kwp,
        date.autoconsum, rezultat["economic"]["npv"], rezultat,
    )
    return {"id_simulare": id_simulare, "rezultat": rezultat}


# Listeaza simularile salvate ale utilizatorului curent (protejat)
@app.get("/simulari")
def listeaza_simulari(
    utilizator=Depends(get_utilizator_curent),
    repo_u: RepozitoriuUtilizatori = Depends(get_repo_utilizatori),
):
    return repo_u.get_simulari(utilizator["id_utilizator"])
