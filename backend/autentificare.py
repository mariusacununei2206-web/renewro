import os
from datetime import datetime, timedelta, timezone
import bcrypt
from jose import jwt

# Secretul de semnare JWT (in productie se pune in variabila de mediu)
SECRET = os.environ.get("RENEWRO_JWT_SECRET", "renewro-dev-secret-schimba-in-productie")
ALGORITM = "HS256"
EXPIRARE_MINUTE = 60 * 24  # token valabil 24 ore


# Cripteaza o parola cu bcrypt (salt aleator inclus)
def hash_parola(parola):
    return bcrypt.hashpw(parola.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# Verifica o parola fata de hash-ul stocat
def verifica_parola(parola, hash_stocat):
    return bcrypt.checkpw(parola.encode("utf-8"), hash_stocat.encode("utf-8"))


# Creeaza un token JWT semnat, cu data de expirare
def creeaza_token(date):
    payload = date.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=EXPIRARE_MINUTE)
    return jwt.encode(payload, SECRET, algorithm=ALGORITM)


# Decodeaza un token JWT (arunca eroare daca e invalid sau expirat)
def decodeaza_token(token):
    return jwt.decode(token, SECRET, algorithms=[ALGORITM])
