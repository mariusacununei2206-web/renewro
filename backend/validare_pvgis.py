import os
import time
import json
import urllib.parse
import urllib.request
from pathlib import Path
from dotenv import load_dotenv

import psycopg2

# Incarca variabilele de mediu din fisierul .env (radacina proiectului)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
from repozitoriu_date import RepozitoriuDate
from modele_productie import ModelProductieSolar

PUTERE_KWP = 5.0
PIERDERI_PVGIS = 14  # % pierderi de sistem (PVGIS)
URL_PVGIS = "https://re.jrc.ec.europa.eu/api/v5_2/PVcalc"


# Cere productia anuala de la PVGIS, in plan orizontal (ca modelul nostru)
def productie_pvgis(lat, lon):
    parametri = urllib.parse.urlencode({
        "lat": lat, "lon": lon,
        "peakpower": PUTERE_KWP, "loss": PIERDERI_PVGIS,
        "angle": 0, "aspect": 0,
        "pvtechchoice": "crystSi", "mountingplace": "free",
        "outputformat": "json",
    })
    with urllib.request.urlopen(f"{URL_PVGIS}?{parametri}", timeout=60) as raspuns:
        date = json.loads(raspuns.read().decode("utf-8"))
    return date["outputs"]["totals"]["fixed"]["E_y"]


# Metrici de eroare intre model si referinta
def metrici(valori_model, valori_referinta):
    n = len(valori_model)
    erori = [m - r for m, r in zip(valori_model, valori_referinta)]
    mae = sum(abs(e) for e in erori) / n
    rmse = (sum(e ** 2 for e in erori) / n) ** 0.5
    mape = sum(abs(e / r) for e, r in zip(erori, valori_referinta)) / n * 100
    return mae, rmse, mape


if __name__ == "__main__":
    conexiune = psycopg2.connect(
        host=os.environ["RENEWRO_DB_HOST"],
        dbname=os.environ["RENEWRO_DB_NAME"],
        user=os.environ["RENEWRO_DB_USER"],
        password=os.environ["RENEWRO_DB_PASSWORD"],
    )
    try:
        repo = RepozitoriuDate(conexiune)
        parametri = repo.get_parametri_economici()

        productii_model = []
        productii_pvgis = []

        print(f"Validare model vs PVGIS — sistem {PUTERE_KWP:.0f} kWp, plan orizontal\n")
        print(f"{'Judet':10s} {'Model':>9s} {'PVGIS':>9s} {'Eroare%':>9s}")
        print("-" * 40)
        for j in repo.get_toate_judetele():
            date_meteo = repo.get_date_meteo(j["id_judet"])
            solar = ModelProductieSolar(PUTERE_KWP, parametri["performance_ratio"])
            e_model = solar.productie_anuala(date_meteo)
            e_pvgis = productie_pvgis(j["latitudine"], j["longitudine"])

            productii_model.append(e_model)
            productii_pvgis.append(e_pvgis)
            eroare = (e_model - e_pvgis) / e_pvgis * 100
            print(f"{j['nume']:10s} {e_model:9.0f} {e_pvgis:9.0f} {eroare:+9.1f}")
            time.sleep(1)  # politete fata de API

        mae, rmse, mape = metrici(productii_model, productii_pvgis)
        print("-" * 40)
        print(f"MAE  = {mae:7.1f} kWh")
        print(f"RMSE = {rmse:7.1f} kWh")
        print(f"MAPE = {mape:7.2f} %")
    finally:
        conexiune.close()
