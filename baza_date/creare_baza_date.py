import os
import psycopg2

# 1. Definirea schemei

SQL_SCHEMA = """
CREATE TABLE IF NOT EXISTS judete (
    id_judet     SERIAL PRIMARY KEY,
    nume         VARCHAR(50)  NOT NULL UNIQUE,
    latitudine   NUMERIC(8,5) NOT NULL,
    longitudine  NUMERIC(8,5) NOT NULL
);

CREATE TABLE IF NOT EXISTS date_meteo (
    id_inregistrare SERIAL PRIMARY KEY,
    id_judet        INTEGER NOT NULL REFERENCES judete(id_judet),
    an              INTEGER NOT NULL,
    luna            INTEGER NOT NULL,
    ghi             NUMERIC(6,3),
    temperatura     NUMERIC(5,2),
    viteza_vant     NUMERIC(5,2),
    UNIQUE (id_judet, an, luna)
);

CREATE TABLE IF NOT EXISTS parametri_economici (
    id_parametru SERIAL PRIMARY KEY,
    denumire     VARCHAR(50) NOT NULL UNIQUE,
    valoare      NUMERIC     NOT NULL,
    unitate      VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS utilizatori (
    id_utilizator SERIAL PRIMARY KEY,
    email         VARCHAR(120) NOT NULL UNIQUE,
    parola_hash   VARCHAR(200) NOT NULL,
    nume          VARCHAR(100),
    data_creare   TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS simulari_salvate (
    id_simulare   SERIAL PRIMARY KEY,
    id_utilizator INTEGER NOT NULL REFERENCES utilizatori(id_utilizator),
    judet         VARCHAR(50),
    putere_kwp    NUMERIC(6,2),
    autoconsum    NUMERIC(4,3),
    npv           NUMERIC,
    rezultat      JSONB,
    data_creare   TIMESTAMP DEFAULT now()
);
"""

# 2. Datele de referinta

JUDETE = [
    ("Bacau", 46.57000, 26.91000),
    ("Botosani", 47.75000, 26.67000),
    ("Galati", 45.44000, 28.05000),
    ("Iasi", 47.16000, 27.59000),
    ("Neamt", 46.93000, 26.37000),  # Piatra Neamt
    ("Suceava", 47.65000, 26.26000),
    ("Vaslui", 46.64000, 27.73000),
    ("Vrancea", 45.70000, 27.19000),  # Focsani
]

# Parametri economici

PARAMETRI = [
    ("pret_energie_retail", 1.30, "lei/kWh"),  # factura evitata prin autoconsum
    ("pret_injectie", 0.50, "lei/kWh"),  # pret producator pentru energia injectata
    ("rata_scont", 0.08, "adimensional"),  # rata de actualizare in DCF
    ("performance_ratio", 0.80, "adimensional"),  # PR pentru modelul solar
    ("durata_viata", 25, "ani"),  # orizontul financiar
    ("factor_emisie_co2", 0.30, "kg/kWh"),  # (*) factorul retelei romanesti
    ("cost_unitar_kwp", 5000, "lei/kWp"),  # (*) CAPEX orientativ per kWp instalat
    ("subventie_casa_verde", 20000, "lei"),  # subventia Casa Verde Fotovoltaice
]


class CreatorBazaDate:

    # Initializare (primeste conexiunea din afara)
    def __init__(self, conexiune):
        self.conexiune = conexiune

    # Creeaza cele 3 tabele (idempotent)
    def creeaza_tabele(self):
        with self.conexiune.cursor() as cursor:
            cursor.execute(SQL_SCHEMA)
        self.conexiune.commit()
        print("Tabelele au fost create cu succes.")

    # Populeaza judetele de referinta
    def populeaza_judete(self):
        sql = """
            INSERT INTO judete (nume, latitudine, longitudine)
            VALUES (%s, %s, %s)
            ON CONFLICT (nume) DO NOTHING
        """
        with self.conexiune.cursor() as cursor:
            cursor.executemany(sql, JUDETE)
        self.conexiune.commit()
        print(f"Judete inserate: {len(JUDETE)}.")

    # Populeaza parametrii economici de referinta
    def populeaza_parametri(self):
        sql = """
            INSERT INTO parametri_economici (denumire, valoare, unitate)
            VALUES (%s, %s, %s)
            ON CONFLICT (denumire) DO NOTHING
        """
        with self.conexiune.cursor() as cursor:
            cursor.executemany(sql, PARAMETRI)
        self.conexiune.commit()
        print(f"Parametri economici inserati: {len(PARAMETRI)}.")

    # Ruleaza tot fluxul de creare
    def ruleaza_tot(self):
        self.creeaza_tabele()
        self.populeaza_judete()
        self.populeaza_parametri()


# 3. Punct de intrare
if __name__ == "__main__":
    conexiune = psycopg2.connect(
        host=os.environ["RENEWRO_DB_HOST"],
        dbname=os.environ["RENEWRO_DB_NAME"],
        user=os.environ["RENEWRO_DB_USER"],
        password=os.environ["RENEWRO_DB_PASSWORD"],
    )
    try:
        creator = CreatorBazaDate(conexiune)
        creator.ruleaza_tot()
        print("Schema exista si referintele sunt populate.")
    finally:
        conexiune.close()
