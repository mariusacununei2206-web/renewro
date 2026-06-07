from modele_productie import ModelProductieSolar, ModelProductieEolian
from motor_economic import MotorEconomic
from analiza_risc import AnalizaRisc


class ServiciuSimulare:

    # Initializare (primeste repozitoriul; citeste o data parametrii economici)
    def __init__(self, repozitoriu):
        self.repozitoriu = repozitoriu
        self.parametri = repozitoriu.get_parametri_economici()

    # Helper: adu judetul si seria lui meteo (sau eroare daca nu exista)
    def _adu_judet_si_date(self, nume_judet):
        judet = self.repozitoriu.get_judet_dupa_nume(nume_judet)
        if judet is None:
            raise ValueError(f"Judetul '{nume_judet}' nu exista in baza.")
        date_meteo = self.repozitoriu.get_date_meteo(judet["id_judet"])
        return judet, date_meteo

    # Helper: mediile meteo multianuale (pentru afisare)
    def _meteo_mediu(self, date_meteo):
        n = len(date_meteo) or 1
        return {
            "ghi": sum(d["ghi"] for d in date_meteo) / n,
            "temperatura": sum(d["temperatura"] for d in date_meteo) / n,
            "viteza_vant": sum(d["viteza_vant"] for d in date_meteo) / n,
        }

    # Simulare completa pentru un sistem solar intr-un judet
    def simuleaza(self, nume_judet, putere_kwp, fractie_autoconsum):
        # 1. Adu datele
        judet, date_meteo = self._adu_judet_si_date(nume_judet)

        # 2. Construieste lantul (model solar -> motor -> risc)
        solar = ModelProductieSolar(putere_kwp, self.parametri["performance_ratio"])
        motor = MotorEconomic(self.parametri)
        risc = AnalizaRisc(solar, motor)

        # 3. Calculeaza
        capex = putere_kwp * self.parametri["cost_unitar_kwp"]
        energie = solar.productie_anuala(date_meteo)            # an tipic (media)
        productie_lunara = solar.productie_lunara(date_meteo)   # pentru grafic
        economic = motor.calculeaza_tot(energie, fractie_autoconsum, capex)
        scenarii = risc.scenarii_p50_p90(date_meteo)
        npv_scenarii = risc.npv_p50_p90(date_meteo, fractie_autoconsum, capex)
        senzitivitate = risc.senzitivitate_autoconsum(
            energie, capex, [0.20, 0.40, 0.60, 0.80]
        )

        # 4. Asambleaza rezultatul (RezultatSimulare, gata de JSON)
        return {
            "judet": judet,
            "intrari": {
                "putere_kwp": putere_kwp,
                "fractie_autoconsum": fractie_autoconsum,
                "capex": capex,
            },
            "durata_viata": motor.durata_viata,
            "energie_anuala": energie,
            "productie_lunara": productie_lunara,
            "meteo": self._meteo_mediu(date_meteo),
            "economic": economic,
            "scenarii_productie": scenarii,
            "npv_scenarii": npv_scenarii,
            "senzitivitate_autoconsum": senzitivitate,
        }

    # Comparatie de productie solar vs eolian in acelasi judet (sustine H3)
    def compara_solar_eolian(self, nume_judet, putere_kwp,
                             diametru_rotor=3.0, coeficient_putere=0.40):
        judet, date_meteo = self._adu_judet_si_date(nume_judet)
        solar = ModelProductieSolar(putere_kwp, self.parametri["performance_ratio"])
        eolian = ModelProductieEolian(diametru_rotor, coeficient_putere)
        return {
            "judet": judet["nume"],
            "solar_kwh": solar.productie_anuala(date_meteo),
            "eolian_kwh": eolian.productie_anuala(date_meteo),
        }


# Punct de intrare (test rapid: o simulare completa pe date reale)
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
        serviciu = ServiciuSimulare(repo)

        rez = serviciu.simuleaza("Iasi", putere_kwp=5.0, fractie_autoconsum=0.40)

        print(f"=== Simulare: {rez['judet']['nume']} "
              f"{rez['intrari']['putere_kwp']:.0f} kWp, "
              f"autoconsum {rez['intrari']['fractie_autoconsum']:.0%} ===")
        print(f"Energie (an tipic): {rez['energie_anuala']:.0f} kWh/an")
        print(f"CAPEX:              {rez['intrari']['capex']:.0f} lei")
        e = rez["economic"]
        print(f"NPV:    {e['npv']:.0f} lei | IRR: {e['irr'] * 100:.1f}% | "
              f"LCOE: {e['lcoe']:.3f} lei/kWh | payback: {e['payback_simplu']:.1f} ani")
        s = rez["scenarii_productie"]
        print(f"P50: {s['p50']:.0f} kWh/an | P90: {s['p90']:.0f} kWh/an")
        n = rez["npv_scenarii"]
        print(f"NPV @P50: {n['npv_p50']:.0f} lei | NPV @P90: {n['npv_p90']:.0f} lei")

        comp = serviciu.compara_solar_eolian("Iasi", putere_kwp=5.0)
        print(f"\nComparatie {comp['judet']}: "
              f"solar {comp['solar_kwh']:.0f} kWh/an vs "
              f"eolian {comp['eolian_kwh']:.0f} kWh/an")
    finally:
        conexiune.close()
