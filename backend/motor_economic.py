class MotorEconomic:

    # Initializare (primeste parametrii economici ca dict, din repozitoriu)
    def __init__(self, parametri):
        self.pret_retail = parametri["pret_energie_retail"]
        self.pret_injectie = parametri["pret_injectie"]
        self.rata_scont = parametri["rata_scont"]
        self.durata_viata = int(parametri["durata_viata"])
        self.factor_emisie_co2 = parametri["factor_emisie_co2"]

    # Beneficiul anual: autoconsum (factura evitata) + injectie (pret producator)
    def beneficiu_anual(self, energie_anuala, fractie_autoconsum):
        autoconsumat = energie_anuala * fractie_autoconsum
        injectat = energie_anuala * (1 - fractie_autoconsum)
        return autoconsumat * self.pret_retail + injectat * self.pret_injectie

    # NPV = -CAPEX + suma beneficiilor actualizate pe durata de viata
    def npv(self, energie_anuala, fractie_autoconsum, capex):
        beneficiu = self.beneficiu_anual(energie_anuala, fractie_autoconsum)
        valoare = -capex
        for an in range(1, self.durata_viata + 1):
            valoare += beneficiu / (1 + self.rata_scont) ** an
        return valoare

    # Payback simplu = CAPEX / beneficiu anual (fara actualizare)
    def payback_simplu(self, energie_anuala, fractie_autoconsum, capex):
        beneficiu = self.beneficiu_anual(energie_anuala, fractie_autoconsum)
        return capex / beneficiu

    # Payback actualizat = primul an in care beneficiile actualizate acopera CAPEX
    def payback_actualizat(self, energie_anuala, fractie_autoconsum, capex):
        beneficiu = self.beneficiu_anual(energie_anuala, fractie_autoconsum)
        cumulat = 0.0
        for an in range(1, self.durata_viata + 1):
            cumulat += beneficiu / (1 + self.rata_scont) ** an
            if cumulat >= capex:
                return an
        return None  # nu se recupereaza in durata de viata

    # IRR = rata la care NPV = 0 (cautata prin bisectie)
    def irr(self, energie_anuala, fractie_autoconsum, capex):
        beneficiu = self.beneficiu_anual(energie_anuala, fractie_autoconsum)

        # NPV ca functie de rata (descrescatoare in rata)
        def npv_la_rata(rata):
            valoare = -capex
            for an in range(1, self.durata_viata + 1):
                valoare += beneficiu / (1 + rata) ** an
            return valoare

        # Daca nici la 0% nu e profitabil, IRR nu exista
        if npv_la_rata(0.0) <= 0:
            return None

        # Bisectie intre 0% si 100%
        jos, sus = 0.0, 1.0
        for _ in range(100):
            mij = (jos + sus) / 2
            if npv_la_rata(mij) > 0:
                jos = mij
            else:
                sus = mij
        return (jos + sus) / 2

    # LCOE = CAPEX / energia actualizata pe durata de viata
    def lcoe(self, energie_anuala, capex):
        energie_actualizata = 0.0
        for an in range(1, self.durata_viata + 1):
            energie_actualizata += energie_anuala / (1 + self.rata_scont) ** an
        return capex / energie_actualizata

    # CO2 evitat anual (indicator de mediu)
    def co2_evitat_anual(self, energie_anuala):
        return energie_anuala * self.factor_emisie_co2

    # Toti indicatorii intr-un dictionar (folosit de ServiciuSimulare / API)
    def calculeaza_tot(self, energie_anuala, fractie_autoconsum, capex):
        return {
            "beneficiu_anual": self.beneficiu_anual(energie_anuala, fractie_autoconsum),
            "npv": self.npv(energie_anuala, fractie_autoconsum, capex),
            "irr": self.irr(energie_anuala, fractie_autoconsum, capex),
            "lcoe": self.lcoe(energie_anuala, capex),
            "payback_simplu": self.payback_simplu(energie_anuala, fractie_autoconsum, capex),
            "payback_actualizat": self.payback_actualizat(energie_anuala, fractie_autoconsum, capex),
            "co2_evitat_anual": self.co2_evitat_anual(energie_anuala),
        }


# Punct de intrare (test rapid: lant complet model -> motor, pe date reale)
if __name__ == "__main__":
    import os
    import psycopg2
    from repozitoriu_date import RepozitoriuDate
    from modele_productie import ModelProductieSolar

    conexiune = psycopg2.connect(
        host=os.environ["RENEWRO_DB_HOST"],
        dbname=os.environ["RENEWRO_DB_NAME"],
        user=os.environ["RENEWRO_DB_USER"],
        password=os.environ["RENEWRO_DB_PASSWORD"],
    )
    try:
        repo = RepozitoriuDate(conexiune)
        parametri = repo.get_parametri_economici()

        # Date de intrare
        putere_kwp = 5.0
        fractie_autoconsum = 0.40

        # Energia (model solar) + investitia (CAPEX)
        iasi = repo.get_judet_dupa_nume("Iasi")
        date = repo.get_date_meteo(iasi["id_judet"])
        solar = ModelProductieSolar(putere_kwp, parametri["performance_ratio"])
        energie = solar.productie_anuala(date)
        capex = putere_kwp * parametri["cost_unitar_kwp"]

        # Indicatorii economici
        motor = MotorEconomic(parametri)
        r = motor.calculeaza_tot(energie, fractie_autoconsum, capex)

        print(f"Iasi {putere_kwp:.0f} kWp, autoconsum {fractie_autoconsum:.0%}")
        print(f"  Energie:            {energie:.0f} kWh/an")
        print(f"  CAPEX:              {capex:.0f} lei")
        print(f"  Beneficiu anual:    {r['beneficiu_anual']:.0f} lei/an")
        print(f"  NPV (25 ani):       {r['npv']:.0f} lei")
        print(f"  IRR:                {r['irr'] * 100:.1f} %")
        print(f"  LCOE:               {r['lcoe']:.3f} lei/kWh")
        print(f"  Payback simplu:     {r['payback_simplu']:.1f} ani")
        print(f"  Payback actualizat: {r['payback_actualizat']} ani")
        print(f"  CO2 evitat:         {r['co2_evitat_anual']:.0f} kg/an")
    finally:
        conexiune.close()
