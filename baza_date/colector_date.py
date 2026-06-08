import os
import time
import requests
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

# Incarca variabilele de mediu din fisierul .env (radacina proiectului)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class ColectorDate:
    URL_BAZA = "https://power.larc.nasa.gov/api/temporal/monthly/point"
    PARAMETRI = "ALLSKY_SFC_SW_DWN,T2M,WS10M"
    COMUNITATE = "RE"
    AN_START = 2005
    AN_FINAL = 2025
    VALOARE_LIPSA = -999

    # Initializare (primeste conexiunea din afara)
    def __init__(self, conexiune):
        self.conexiune = conexiune

    # Construieste URL-ul NASA POWER (parametri in engleza, ii cere API-ul)
    def _construieste_url(self, latitudine, longitudine):
        return (
            f"{self.URL_BAZA}"
            f"?parameters={self.PARAMETRI}"
            f"&community={self.COMUNITATE}"
            f"&latitude={latitudine}"
            f"&longitude={longitudine}"
            f"&start={self.AN_START}"
            f"&end={self.AN_FINAL}"
            f"&format=JSON"
        )

    # Descarca raspunsul JSON de la NASA
    def _descarca(self, latitudine, longitudine):
        url = self._construieste_url(latitudine, longitudine)
        raspuns = requests.get(url, timeout=60)
        raspuns.raise_for_status()
        return raspuns.json()

    # Transforma JSON-ul in randuri (sare luna 13 si valorile -999)
    def _parseaza(self, raspuns_json):
        p = raspuns_json["properties"]["parameter"]
        ghi_lunar = p["ALLSKY_SFC_SW_DWN"]
        temp_lunar = p["T2M"]
        vant_lunar = p["WS10M"]

        inregistrari = []
        for cheie in ghi_lunar:
            an = int(cheie[:4])
            luna = int(cheie[4:6])
            if luna == 13:
                continue

            ghi = ghi_lunar[cheie]
            temp = temp_lunar[cheie]
            vant = vant_lunar[cheie]
            if self.VALOARE_LIPSA in (ghi, temp, vant):
                continue

            inregistrari.append((an, luna, ghi, temp, vant))
        return inregistrari

    # Scrie randurile in date_meteo (idempotent)
    def _scrie_in_baza(self, id_judet, inregistrari):
        sql = """
            INSERT INTO date_meteo
                (id_judet, an, luna, ghi, temperatura, viteza_vant)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (id_judet, an, luna) DO NOTHING
        """
        randuri = [
            (id_judet, an, luna, ghi, temp, vant)
            for (an, luna, ghi, temp, vant) in inregistrari
        ]
        with self.conexiune.cursor() as cursor:
            cursor.executemany(sql, randuri)
        self.conexiune.commit()
        return len(randuri)

    # Colecteaza pentru toate judetele din baza
    def colecteaza_tot(self):
        with self.conexiune.cursor() as cursor:
            cursor.execute(
                "SELECT id_judet, nume, latitudine, longitudine"
                " FROM judete ORDER BY id_judet"
            )
            judete = cursor.fetchall()

        for (id_judet, nume, latitudine, longitudine) in judete:
            print(f" -> {nume}: descarc date din NASA POWER...")
            raspuns = self._descarca(latitudine, longitudine)
            inregistrari = self._parseaza(raspuns)
            scrise = self._scrie_in_baza(id_judet, inregistrari)
            print(f"    {nume}: {scrise} inregistrari lunare salvate.")
            time.sleep(1)


if __name__ == "__main__":
    conexiune = psycopg2.connect(
        host=os.environ["RENEWRO_DB_HOST"],
        dbname=os.environ["RENEWRO_DB_NAME"],
        user=os.environ["RENEWRO_DB_USER"],
        password=os.environ["RENEWRO_DB_PASSWORD"],
    )
    try:
        colector = ColectorDate(conexiune)
        colector.colecteaza_tot()
        print("Tabela cu date meteorologice a fost populata!")
    finally:
        conexiune.close()
