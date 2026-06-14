import json


class RepozitoriuUtilizatori:

    # Initializare (primeste conexiunea din afara)
    def __init__(self, conexiune):
        self.conexiune = conexiune

    # Creeaza un utilizator nou si intoarce id-ul
    def creeaza_utilizator(self, email, parola_hash, nume):
        sql = """
            INSERT INTO utilizatori (email, parola_hash, nume)
            VALUES (%s, %s, %s)
            RETURNING id_utilizator
        """
        with self.conexiune.cursor() as cursor:
            cursor.execute(sql, (email, parola_hash, nume))
            id_utilizator = cursor.fetchone()[0]
        self.conexiune.commit()
        return id_utilizator

    # Cauta un utilizator dupa email
    def get_utilizator_dupa_email(self, email):
        with self.conexiune.cursor() as cursor:
            cursor.execute(
                "SELECT id_utilizator, email, parola_hash, nume"
                " FROM utilizatori WHERE email = %s",
                (email,),
            )
            r = cursor.fetchone()
        if r is None:
            return None
        return {"id_utilizator": r[0], "email": r[1], "parola_hash": r[2], "nume": r[3]}

    # Salveaza o simulare a unui utilizator
    def salveaza_simulare(self, id_utilizator, judet, putere_kwp, autoconsum, npv, rezultat):
        sql = """
            INSERT INTO simulari_salvate
                (id_utilizator, judet, putere_kwp, autoconsum, npv, rezultat)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id_simulare
        """
        with self.conexiune.cursor() as cursor:
            cursor.execute(sql, (id_utilizator, judet, putere_kwp, autoconsum, npv, json.dumps(rezultat)))
            id_simulare = cursor.fetchone()[0]
        self.conexiune.commit()
        return id_simulare

    # Listeaza simularile salvate ale unui utilizator
    def get_simulari(self, id_utilizator):
        with self.conexiune.cursor() as cursor:
            cursor.execute(
                "SELECT id_simulare, judet, putere_kwp, autoconsum, npv, data_creare, principala"
                " FROM simulari_salvate WHERE id_utilizator = %s ORDER BY data_creare DESC",
                (id_utilizator,),
            )
            randuri = cursor.fetchall()
        return [
            {
                "id_simulare": r[0],
                "judet": r[1],
                "putere_kwp": float(r[2]),
                "autoconsum": float(r[3]),
                "npv": float(r[4]) if r[4] is not None else None,
                "data": str(r[5]),
                "principala": bool(r[6]),
            }
            for r in randuri
        ]

    # Marcheaza o simulare ca principala (si o demoteaza pe cea veche)
    def seteaza_principala(self, id_utilizator, id_simulare):
        with self.conexiune.cursor() as cursor:
            cursor.execute(
                "UPDATE simulari_salvate SET principala = FALSE WHERE id_utilizator = %s",
                (id_utilizator,),
            )
            cursor.execute(
                "UPDATE simulari_salvate SET principala = TRUE"
                " WHERE id_simulare = %s AND id_utilizator = %s",
                (id_simulare, id_utilizator),
            )
        self.conexiune.commit()

    # Simularea principala a utilizatorului (cu rezultatul salvat) sau None
    def get_principala(self, id_utilizator):
        with self.conexiune.cursor() as cursor:
            cursor.execute(
                "SELECT id_simulare, judet, putere_kwp, autoconsum, rezultat"
                " FROM simulari_salvate WHERE id_utilizator = %s AND principala = TRUE LIMIT 1",
                (id_utilizator,),
            )
            r = cursor.fetchone()
        if r is None:
            return None
        return {
            "id_simulare": r[0],
            "judet": r[1],
            "putere_kwp": float(r[2]),
            "autoconsum": float(r[3]),
            "rezultat": r[4],
        }
