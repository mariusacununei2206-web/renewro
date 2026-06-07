import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.cluster import KMeans
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


# Construieste setul de antrenare: (luna, lat, lon) -> ghi, pentru toate judetele
def construieste_set_date(repozitoriu):
    randuri = []
    for j in repozitoriu.get_toate_judetele():
        for d in repozitoriu.get_date_meteo(j["id_judet"]):
            randuri.append({
                "luna": d["luna"],
                "lat": j["latitudine"],
                "lon": j["longitudine"],
                "temperatura": d["temperatura"],
                "viteza_vant": d["viteza_vant"],
                "ghi": d["ghi"],
            })
    return randuri


# Profilul mediu energetic al fiecarui judet (pentru clusterizare)
def construieste_profile_judete(repozitoriu):
    profile = []
    for j in repozitoriu.get_toate_judetele():
        date = repozitoriu.get_date_meteo(j["id_judet"])
        n = len(date) or 1
        profile.append({
            "nume": j["nume"],
            "ghi_mediu": sum(d["ghi"] for d in date) / n,
            "vant_mediu": sum(d["viteza_vant"] for d in date) / n,
            "temp_medie": sum(d["temperatura"] for d in date) / n,
        })
    return profile


class EstimatorRadiatie:
    CARACTERISTICI = ["luna", "lat", "lon", "temperatura", "viteza_vant"]

    def __init__(self):
        self.model = RandomForestRegressor(n_estimators=150, random_state=42)
        self.antrenat = False

    # Transforma randurile in matricea X (caracteristici) si vectorul y (tinta)
    def _matrice(self, randuri):
        X = np.array([[r[c] for c in self.CARACTERISTICI] for r in randuri], dtype=float)
        y = np.array([r["ghi"] for r in randuri], dtype=float)
        return X, y

    # Antreneaza pe tot setul (pentru estimari)
    def antreneaza(self, randuri):
        X, y = self._matrice(randuri)
        self.model.fit(X, y)
        self.antrenat = True
        return self

    # Estimeaza GHI pentru o locatie, luna si conditii meteo
    def estimeaza(self, luna, lat, lon, temperatura, viteza_vant):
        X = np.array([[luna, lat, lon, temperatura, viteza_vant]], dtype=float)
        return float(self.model.predict(X)[0])

    # Validare: train/test + cross-validation + comparatie cu baseline sezonier
    def valideaza(self, randuri):
        X, y = self._matrice(randuri)
        X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)

        model = RandomForestRegressor(n_estimators=150, random_state=42)
        model.fit(X_tr, y_tr)
        pred = model.predict(X_te)

        mae = mean_absolute_error(y_te, pred)
        rmse = mean_squared_error(y_te, pred) ** 0.5
        mape = float(np.mean(np.abs((y_te - pred) / y_te)) * 100)
        r2 = r2_score(y_te, pred)

        # Cross-validation (5 felii) pe R2
        cv = cross_val_score(
            RandomForestRegressor(n_estimators=150, random_state=42),
            X, y, cv=5, scoring="r2",
        )

        # Baseline sezonier: "ghicim" media GHI a lunii respective
        medii_luna = {}
        for r in randuri:
            medii_luna.setdefault(r["luna"], []).append(r["ghi"])
        medii_luna = {l: float(np.mean(v)) for l, v in medii_luna.items()}
        baseline_pred = np.array([medii_luna[int(x[0])] for x in X_te])
        mae_baseline = mean_absolute_error(y_te, baseline_pred)

        return {
            "r2": round(float(r2), 4),
            "mae": round(float(mae), 4),
            "rmse": round(float(rmse), 4),
            "mape": round(mape, 2),
            "cv_r2_mediu": round(float(cv.mean()), 4),
            "cv_r2_std": round(float(cv.std()), 4),
            "mae_baseline_sezonier": round(float(mae_baseline), 4),
            "n_total": int(len(y)),
            "n_test": int(len(y_te)),
        }


class ClusterizareJudete:
    def __init__(self, n_clustere=3):
        self.n_clustere = n_clustere
        self.model = KMeans(n_clusters=n_clustere, random_state=42, n_init=10)

    # Grupeaza judetele in clase de potential dupa (ghi, vant, temperatura)
    def clusterizeaza(self, profile):
        X = np.array([[p["ghi_mediu"], p["vant_mediu"], p["temp_medie"]] for p in profile], dtype=float)

        # Standardizare (z-score) ca nicio variabila sa nu domine
        medii = X.mean(axis=0)
        abateri = X.std(axis=0)
        abateri[abateri == 0] = 1.0
        X_std = (X - medii) / abateri

        etichete = self.model.fit_predict(X_std)

        # Re-etichetare: 0 = potential mic ... n-1 = mare (dupa GHI mediu)
        ghi_pe_cluster = {}
        for p, e in zip(profile, etichete):
            ghi_pe_cluster.setdefault(int(e), []).append(p["ghi_mediu"])
        ordine = sorted(ghi_pe_cluster, key=lambda c: np.mean(ghi_pe_cluster[c]))
        remap = {vechi: nou for nou, vechi in enumerate(ordine)}

        return [{**p, "cluster": int(remap[int(e)])} for p, e in zip(profile, etichete)]


# Punct de intrare (test rapid pe date reale)
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

        print("Estimator radiatie (Random Forest)")
        for k, v in EstimatorRadiatie().valideaza(construieste_set_date(repo)).items():
            print(f"  {k}: {v}")

        print("Clusterizare judete (K-means)")
        clustere = ClusterizareJudete(3).clusterizeaza(construieste_profile_judete(repo))
        for c in sorted(clustere, key=lambda x: -x["cluster"]):
            print(f"  cluster {c['cluster']} | {c['nume']:10s} | GHI {c['ghi_mediu']:.2f}")
    finally:
        conexiune.close()
