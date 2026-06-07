import math
from abc import ABC, abstractmethod

# Constante fizice

G_REF = 1.0        # iradianta de referinta STC, kW/m2
RHO = 1.225        # densitatea aerului la nivelul marii, kg/m3
BETZ = 0.593       # limita teoretica Betz pentru Cp

# Zile per luna (an mediu; suficient pentru estimare lunara)
ZILE_LUNA = {1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30,
             7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31}


class ModelProductie(ABC):

    # Cod comun: media multianuala a unui camp, grupata pe luna
    @staticmethod
    def _medie_lunara(date_meteo, camp):
        sume = {}
        nr = {}
        for d in date_meteo:
            luna = d["luna"]
            sume[luna] = sume.get(luna, 0.0) + d[camp]
            nr[luna] = nr.get(luna, 0) + 1
        return {luna: sume[luna] / nr[luna] for luna in sume}

    # Contract: fiecare model stie sa dea productia lunara {luna: kWh}
    @abstractmethod
    def productie_lunara(self, date_meteo):
        ...

    # Productia anuala = suma celor 12 luni (acelasi pentru orice model)
    def productie_anuala(self, date_meteo):
        return sum(self.productie_lunara(date_meteo).values())


class ModelProductieSolar(ModelProductie):

    # Parametrii sistemului fotovoltaic (injectati din afara)
    def __init__(self, putere_kwp, performance_ratio):
        self.putere_kwp = putere_kwp
        self.performance_ratio = performance_ratio

    # E_luna = P_instalat x (H_plan / G_ref) x PR
    def productie_lunara(self, date_meteo):
        medie_ghi = self._medie_lunara(date_meteo, "ghi")  # kWh/m2/zi, mediat pe ani
        rezultat = {}
        for luna, ghi_zi in medie_ghi.items():
            h_plan = ghi_zi * ZILE_LUNA[luna]              # kWh/m2 in luna respectiva
            rezultat[luna] = self.putere_kwp * (h_plan / G_REF) * self.performance_ratio
        return rezultat


class ModelProductieEolian(ModelProductie):

    # Parametrii turbinei (injectati din afara)
    def __init__(self, diametru_rotor, coeficient_putere):
        self.diametru_rotor = diametru_rotor
        self.coeficient_putere = coeficient_putere
        self.arie = math.pi * (diametru_rotor / 2) ** 2    # aria maturata de rotor, m2

    # P = 1/2 x rho x A x v^3 x Cp  ->  energie pe luna
    def productie_lunara(self, date_meteo):
        medie_vant = self._medie_lunara(date_meteo, "viteza_vant")  # m/s la 10 m
        rezultat = {}
        for luna, v in medie_vant.items():
            putere_w = 0.5 * RHO * self.arie * (v ** 3) * self.coeficient_putere
            ore = ZILE_LUNA[luna] * 24
            rezultat[luna] = putere_w * ore / 1000.0       # Wh -> kWh
        return rezultat


# Punct de intrare (test rapid: ia date reale din baza si estimeaza productia)
if __name__ == "__main__":
    import os
    import psycopg2
    from repozitoriu_date import RepozitoriuDate

    conexiune = psycopg2.connect(
        host=os.environ["RENEWRO_DB_HOST"],
        dbname=os.environ["RENEWRO_DB_NAME"],
        user=os.environ["RENEWRO_DB_USER"],
        password=os.environ["RENEWRO_DB_PASSWORD"],
    )
    try:
        repo = RepozitoriuDate(conexiune)
        parametri = repo.get_parametri_economici()

        # Ia seria meteo a unui judet
        iasi = repo.get_judet_dupa_nume("Iasi")
        date = repo.get_date_meteo(iasi["id_judet"])

        # Construieste modelele (PR vine din parametrii economici)
        solar = ModelProductieSolar(
            putere_kwp=5.0,
            performance_ratio=parametri["performance_ratio"],
        )
        eolian = ModelProductieEolian(
            diametru_rotor=3.0,
            coeficient_putere=0.40,
        )

        print(f"Iasi - solar 5 kWp:  {solar.productie_anuala(date):.0f} kWh/an")
        print(f"Iasi - eolian d=3m:  {eolian.productie_anuala(date):.0f} kWh/an")
    finally:
        conexiune.close()
