import os
import psycopg2
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from repozitoriu_date import RepozitoriuDate
from serviciu_simulare import ServiciuSimulare

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
    serviciu: ServiciuSimulare = Depends(get_serviciu),
):
    try:
        return serviciu.simuleaza(judet, putere_kwp, autoconsum)
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
