import os
import psycopg2
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from repozitoriu_date import RepozitoriuDate
from serviciu_simulare import ServiciuSimulare
from model_ml import (
    EstimatorRadiatie, ClusterizareJudete,
    construieste_set_date, construieste_profile_judete,
)

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


# Estimator ML antrenat o singura data (cache global)
_estimator = None


def _get_estimator(repozitoriu):
    global _estimator
    if _estimator is None:
        _estimator = EstimatorRadiatie().antreneaza(construieste_set_date(repozitoriu))
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
    return EstimatorRadiatie().valideaza(construieste_set_date(repozitoriu))


# Clusterizarea judetelor in clase de potential (K-means)
@app.get("/ml/clustere")
def ml_clustere(
    n: int = Query(3, ge=2, le=5, description="Numar de clase"),
    repozitoriu: RepozitoriuDate = Depends(get_repozitoriu),
):
    profile = construieste_profile_judete(repozitoriu)
    return ClusterizareJudete(n_clustere=n).clusterizeaza(profile)
