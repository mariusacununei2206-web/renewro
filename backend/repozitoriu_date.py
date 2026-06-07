import os
import psycopg2


class RepozitoriuDate:

    # Initializare (primeste conexiunea din afara)
    def __init__(self, conexiune):
        self.conexiune = conexiune

    # Citeste toate judetele
    def get_toate_judetele(self):
        with self.conexiune.cursor() as cursor:
            cursor.execute(
                "SELECT id_judet, nume, latitudine, longitudine"
                " FROM judete ORDER BY nume"
            )
            randuri = cursor.fetchall()
        return [
            {"id_judet": r[0], "nume": r[1],
             "latitudine": float(r[2]), "longitudine": float(r[3])}
            for r in randuri
        ]

    # Cauta un singur judet dupa nume
    def get_judet_dupa_nume(self, nume):
        with self.conexiune.cursor() as cursor:
            cursor.execute(
                "SELECT id_judet, nume, latitudine, longitudine"
                " FROM judete WHERE nume = %s",
                (nume,),
            )
            r = cursor.fetchone()
        if r is None:
            return None
        return {"id_judet": r[0], "nume": r[1],
                "latitudine": float(r[2]), "longitudine": float(r[3])}

    # Citeste seria meteo lunara a unui judet
    def get_date_meteo(self, id_judet):
        with self.conexiune.cursor() as cursor:
            cursor.execute(
                "SELECT an, luna, ghi, temperatura, viteza_vant"
                " FROM date_meteo WHERE id_judet = %s ORDER BY an, luna",
                (id_judet,),
            )
            randuri = cursor.fetchall()
        return [
            {"an": r[0], "luna": r[1], "ghi": float(r[2]),
             "temperatura": float(r[3]), "viteza_vant": float(r[4])}
            for r in randuri
        ]

    # Citeste parametrii economici ca dictionar {denumire: valoare}
    def get_parametri_economici(self):
        with self.conexiune.cursor() as cursor:
            cursor.execute("SELECT denumire, valoare FROM parametri_economici")
            randuri = cursor.fetchall()
        return {denumire: float(valoare) for (denumire, valoare) in randuri}


# Punct de intrare (test rapid: citeste si afiseaza din baza)
if __name__ == "__main__":
    conexiune = psycopg2.connect(
        host=os.environ["RENEWRO_DB_HOST"],
        dbname=os.environ["RENEWRO_DB_NAME"],
        user=os.environ["RENEWRO_DB_USER"],
        password=os.environ["RENEWRO_DB_PASSWORD"],
    )
    try:
        repo = RepozitoriuDate(conexiune)

        # Toate judetele
        print("Judete:")
        for j in repo.get_toate_judetele():
            print(f"  {j['id_judet']}. {j['nume']} ({j['latitudine']}, {j['longitudine']})")

        # Parametrii economici
        print("\nParametri economici:")
        for nume, valoare in repo.get_parametri_economici().items():
            print(f"  {nume} = {valoare}")

        # Seria meteo pentru un judet (Iasi)
        iasi = repo.get_judet_dupa_nume("Iasi")
        date = repo.get_date_meteo(iasi["id_judet"])
        print(f"\nIasi are {len(date)} inregistrari meteo. Primele 3:")
        for d in date[:3]:
            print(f"  {d['an']}-{d['luna']:02d}: GHI={d['ghi']}, T={d['temperatura']}, vant={d['viteza_vant']}")
    finally:
        conexiune.close()
