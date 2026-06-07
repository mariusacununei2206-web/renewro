class AnalizaRisc:

    # Initializare (primeste modelul de productie si motorul economic)
    def __init__(self, model, motor):
        self.model = model
        self.motor = motor

    # Productia fiecarui an complet (12 luni) -> lista sortata crescator (kWh)
    def productii_anuale(self, date_meteo):
        pe_an = {}
        for d in date_meteo:
            pe_an.setdefault(d["an"], []).append(d)
        productii = [
            self.model.productie_anuala(randuri)
            for an, randuri in pe_an.items()
            if len(randuri) == 12  # doar ani compleți (fara luni filtrate)
        ]
        return sorted(productii)

    # Percentila dintr-o lista sortata (interpolare liniara, ca numpy)
    @staticmethod
    def _percentila(valori_sortate, p):
        n = len(valori_sortate)
        if n == 0:
            return None
        if n == 1:
            return valori_sortate[0]
        poz = (p / 100) * (n - 1)
        jos = int(poz)
        sus = min(jos + 1, n - 1)
        frac = poz - jos
        return valori_sortate[jos] + frac * (valori_sortate[sus] - valori_sortate[jos])

    # Scenarii P50 (tipic) si P90 (prudent, depasit in 9 ani din 10)
    def scenarii_p50_p90(self, date_meteo):
        productii = self.productii_anuale(date_meteo)
        return {
            "p50": self._percentila(productii, 50),   # mediana (tipic)
            "p90": self._percentila(productii, 10),   # prudent: depasit in 9 ani din 10
            "p10": self._percentila(productii, 90),   # optimist: depasit doar in 1 an din 10
            "medie": sum(productii) / len(productii),
            "minim": productii[0],
            "maxim": productii[-1],
            "ani": len(productii),
        }

    # NPV in scenariul tipic (P50) si prudent (P90) - viziunea bancii
    def npv_p50_p90(self, date_meteo, fractie_autoconsum, capex):
        s = self.scenarii_p50_p90(date_meteo)
        return {
            "npv_p50": self.motor.npv(s["p50"], fractie_autoconsum, capex),
            "npv_p90": self.motor.npv(s["p90"], fractie_autoconsum, capex),
        }

    # Senzitivitate pe autoconsum (variabila cea mai impactanta)
    def senzitivitate_autoconsum(self, energie_anuala, capex, valori):
        return [
            {
                "autoconsum": f,
                "npv": self.motor.npv(energie_anuala, f, capex),
                "irr": self.motor.irr(energie_anuala, f, capex),
            }
            for f in valori
        ]


# Punct de intrare (test rapid: riscul de productie + economic, pe date reale)
if __name__ == "__main__":
    import os
    import psycopg2
    from repozitoriu_date import RepozitoriuDate
    from modele_productie import ModelProductieSolar
    from motor_economic import MotorEconomic

    conexiune = psycopg2.connect(
        host=os.environ["RENEWRO_DB_HOST"],
        dbname=os.environ["RENEWRO_DB_NAME"],
        user=os.environ["RENEWRO_DB_USER"],
        password=os.environ["RENEWRO_DB_PASSWORD"],
    )
    try:
        repo = RepozitoriuDate(conexiune)
        parametri = repo.get_parametri_economici()

        putere_kwp = 5.0
        fractie_autoconsum = 0.40
        capex = putere_kwp * parametri["cost_unitar_kwp"]

        iasi = repo.get_judet_dupa_nume("Iasi")
        date = repo.get_date_meteo(iasi["id_judet"])

        solar = ModelProductieSolar(putere_kwp, parametri["performance_ratio"])
        motor = MotorEconomic(parametri)
        risc = AnalizaRisc(solar, motor)

        # Scenarii de productie
        s = risc.scenarii_p50_p90(date)
        print(f"Iasi {putere_kwp:.0f} kWp - scenarii productie ({s['ani']} ani):")
        print(f"  P50 (tipic):   {s['p50']:.0f} kWh/an")
        print(f"  P90 (prudent): {s['p90']:.0f} kWh/an")
        print(f"  interval:      [{s['minim']:.0f} .. {s['maxim']:.0f}] kWh/an")

        # NPV in cele doua scenarii
        npv = risc.npv_p50_p90(date, fractie_autoconsum, capex)
        print(f"\nNPV (autoconsum {fractie_autoconsum:.0%}):")
        print(f"  NPV @ P50: {npv['npv_p50']:.0f} lei")
        print(f"  NPV @ P90: {npv['npv_p90']:.0f} lei  (viziunea bancii)")

        # Senzitivitate pe autoconsum (la P50)
        print("\nSenzitivitate pe autoconsum (productie P50):")
        for row in risc.senzitivitate_autoconsum(s["p50"], capex, [0.20, 0.40, 0.60, 0.80]):
            print(f"  {row['autoconsum']:.0%}: NPV={row['npv']:.0f} lei | IRR={row['irr'] * 100:.1f}%")
    finally:
        conexiune.close()
