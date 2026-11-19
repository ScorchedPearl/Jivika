"""Trains the heart and diabetes risk models and measures how good they are.

    python training/train_risk_models.py            # both
    python training/train_risk_models.py heart      # one

Each model is gradient-boosted trees (XGBoost), which read a blank answer as "missing"
instead of needing a made-up value. Every number reported comes from 5-fold
cross-validation: each patient is scored by a model that never saw them.

Writes <name>_risk.json (the model) and <name>_risk.meta.json (features, calibration
and the measured accuracy) next to service.py.
"""
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, confusion_matrix, roc_auc_score
from sklearn.model_selection import StratifiedKFold

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SEED = 2706

SOURCES = {
    "heart.csv": "https://raw.githubusercontent.com/xpy-10/DataSet/main/heart.csv",
    "diabetes_brfss.csv": "https://archive.ics.uci.edu/static/public/891/data.csv",
}


def load(name):
    path = DATA / name
    if not path.exists():
        DATA.mkdir(exist_ok=True)
        print(f"Downloading {name}")
        urllib.request.urlretrieve(SOURCES[name], path)
    return pd.read_csv(path)


def sigmoid(x):
    return 1 / (1 + np.exp(-x))


def balance_missing(X, y, column, rng):
    """Blanks extra values so a column is missing equally often in both classes.

    Without this the model learns "blank means sick" whenever the people who collected
    the data left a value out more often for one group, and a user who skips the
    question would be scored on that accident.
    """
    X = X.copy()
    missing = np.isnan(X[:, column])
    target = max(missing[y == c].mean() for c in (0, 1))
    for c in (0, 1):
        present = np.where((y == c) & ~missing)[0]
        extra = int(round(target * (y == c).sum())) - int(missing[y == c].sum())
        if extra > 0:
            X[rng.choice(present, size=extra, replace=False), column] = np.nan
    return X


def with_blanks(X, y, spec, rng):
    """Training rows, plus copies with optional answers blanked out the way users leave them."""
    for column in spec.get("balance_missing", []):
        X = balance_missing(X, y, column, rng)

    parts, labels = [X], [y]
    for group in spec.get("blank_groups", []):
        copy = X.copy()
        copy[:, group] = np.nan
        parts.append(copy)
        labels.append(y)
    if spec.get("optional"):
        copy = X.copy()
        mask = rng.random((len(X), len(spec["optional"]))) < 0.3
        block = copy[:, spec["optional"]]
        block[mask] = np.nan
        copy[:, spec["optional"]] = block
        parts.append(copy)
        labels.append(y)
    return np.vstack(parts), np.concatenate(labels)


def fit(X, y, spec):
    model = xgb.XGBClassifier(
        **spec["params"],
        monotone_constraints=tuple(spec["monotone"]),
        tree_method="hist",
        random_state=SEED,
        n_jobs=4,
    )
    model.fit(X, y)
    return model


def report(y, probability):
    predicted = (probability >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, predicted).ravel()
    return {
        "auc": round(float(roc_auc_score(y, probability)), 4),
        "accuracy": round(float(accuracy_score(y, predicted)), 4),
        "sensitivity": round(float(tp / (tp + fn)), 4),
        "specificity": round(float(tn / (tn + fp)), 4),
        "brier": round(float(brier_score_loss(y, probability)), 4),
    }


def calibration_table(y, probability, bins=5):
    """Predicted against observed rate, in equal-sized groups."""
    order = np.argsort(probability)
    return [
        {"predicted": round(float(probability[chunk].mean()), 3), "observed": round(float(y[chunk].mean()), 3)}
        for chunk in np.array_split(order, bins)
    ]


def train(name, X, y, spec):
    """spec["views"] names the ways the model is used, each a list of columns blanked for that test."""
    print(f"\n=== {name}: {len(y)} people, {y.mean():.1%} positive ===")
    rng = np.random.default_rng(SEED)
    views = spec["views"]
    margins = {view: np.zeros(len(y)) for view in views}

    folds = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    for train_rows, test_rows in folds.split(X, y):
        model = fit(*with_blanks(X[train_rows], y[train_rows], spec, rng), spec)
        for view, blanked in views.items():
            held_out = X[test_rows].copy()
            held_out[:, blanked] = np.nan
            margins[view][test_rows] = model.predict(held_out, output_margin=True)

    # One straight-line correction of the raw scores, fitted on patients the models hadn't seen,
    # so that "30%" means about 30 in 100
    pooled_margin = np.concatenate(list(margins.values()))
    pooled_y = np.tile(y, len(views))
    platt = LogisticRegression(C=1e6).fit(pooled_margin.reshape(-1, 1), pooled_y)
    a, b = float(platt.coef_[0][0]), float(platt.intercept_[0])

    metrics = {}
    for view in views:
        probability = sigmoid(a * margins[view] + b)
        metrics[view] = report(y, probability)
        metrics[view]["calibration"] = calibration_table(y, probability)
        print(view, {k: v for k, v in metrics[view].items() if k != "calibration"})
        print("   predicted → observed:", ", ".join(f"{r['predicted']:.0%}→{r['observed']:.0%}" for r in metrics[view]["calibration"]))

    final = fit(*with_blanks(X, y, spec, rng), spec)
    final.get_booster().save_model(ROOT / f"{name}_risk.json")
    meta = {
        "features": spec["features"],
        "calibration": {"a": a, "b": b},
        "people": int(len(y)),
        "base_rate": round(float(y.mean()), 4),
        "metrics": metrics,
        "source": spec["source"],
    }
    (ROOT / f"{name}_risk.meta.json").write_text(json.dumps(meta, indent=2))
    return final, meta


# ---- Heart ----

HEART_FEATURES = [
    "Age", "Sex", "ChestPainType", "RestingBP", "Cholesterol", "FastingBS",
    "RestingECG", "MaxHR", "ExerciseAngina", "Oldpeak", "ST_Slope",
]
HEART_CODES = {
    "Sex": {"F": 0, "M": 1},
    "ChestPainType": {"ATA": 0, "NAP": 1, "TA": 2, "ASY": 3},
    "RestingECG": {"Normal": 0, "ST": 1, "LVH": 2},
    "ExerciseAngina": {"N": 0, "Y": 1},
    "ST_Slope": {"Up": 0, "Flat": 1, "Down": 2},
}


def train_heart():
    data = load("heart.csv")
    for column, codes in HEART_CODES.items():
        data[column] = data[column].map(codes)
    # In this dataset a 0 here means "not recorded"
    data.loc[data["Cholesterol"] == 0, "Cholesterol"] = np.nan
    data.loc[data["RestingBP"] == 0, "RestingBP"] = np.nan

    index = {name: i for i, name in enumerate(HEART_FEATURES)}
    stress_test = [index[c] for c in ("RestingECG", "MaxHR", "ExerciseAngina", "Oldpeak", "ST_Slope")]
    blood_test = [index[c] for c in ("Cholesterol", "FastingBS")]

    # +1: the risk can only go up as the value goes up. -1: only down. 0: free.
    monotone = {"Age": 1, "RestingBP": 1, "Cholesterol": 1, "FastingBS": 1, "MaxHR": -1, "ExerciseAngina": 1, "Oldpeak": 1}

    spec = {
        "features": HEART_FEATURES,
        "params": {"n_estimators": 300, "max_depth": 3, "learning_rate": 0.05, "subsample": 0.8, "colsample_bytree": 0.8, "min_child_weight": 2},
        "monotone": [monotone.get(name, 0) for name in HEART_FEATURES],
        "balance_missing": [index["Cholesterol"]],
        "blank_groups": [stress_test, stress_test + blood_test],
        "optional": [index["RestingBP"]] + blood_test + stress_test,
        "views": {"full": [], "no_stress_test": stress_test, "basics_only": stress_test + blood_test},
        "source": "Heart Failure Prediction dataset (fedesoriano): 918 patients from five hospital studies.",
    }
    X = data[HEART_FEATURES].to_numpy(dtype=float)
    y = data["HeartDisease"].to_numpy()
    model, meta = train("heart", X, y, spec)

    # Leaving cholesterol blank should not itself move the score much
    typical = np.array([[55, 1, HEART_CODES["ChestPainType"]["NAP"], 130, 220, 0, 0, 150, 0, 0.0, 0]], dtype=float)
    blank = typical.copy()
    blank[0, index["Cholesterol"]] = np.nan
    a, b = meta["calibration"]["a"], meta["calibration"]["b"]
    with_value, without = (sigmoid(a * model.predict(row, output_margin=True)[0] + b) for row in (typical, blank))
    print(f"Typical patient: {with_value:.1%} with cholesterol 220, {without:.1%} with it left blank")


# ---- Diabetes ----

DIABETES_FEATURES = [
    "Age", "Sex", "BMI", "HighBP", "HighChol", "GenHlth",
    "PhysActivity", "Smoker", "HeartDiseaseorAttack", "Stroke", "DiffWalk",
]


def train_diabetes():
    data = load("diabetes_brfss.csv")
    index = {name: i for i, name in enumerate(DIABETES_FEATURES)}
    unsure = [index["HighBP"], index["HighChol"]]
    monotone = {"Age": 1, "BMI": 1, "HighBP": 1, "HighChol": 1, "GenHlth": 1, "PhysActivity": -1, "HeartDiseaseorAttack": 1, "Stroke": 1, "DiffWalk": 1}

    spec = {
        "features": DIABETES_FEATURES,
        "params": {"n_estimators": 300, "max_depth": 4, "learning_rate": 0.08, "subsample": 0.8, "colsample_bytree": 0.8, "min_child_weight": 20},
        "monotone": [monotone.get(name, 0) for name in DIABETES_FEATURES],
        "optional": unsure,
        "views": {"full": [], "bp_and_cholesterol_unknown": unsure},
        "source": "CDC BRFSS 2015 health survey (UCI dataset 891): 253,680 US adults, self-reported.",
    }
    X = data[DIABETES_FEATURES].to_numpy(dtype=float)
    y = data["Diabetes_binary"].to_numpy()
    train("diabetes", X, y, spec)


if __name__ == "__main__":
    wanted = sys.argv[1:] or ["heart", "diabetes"]
    if "heart" in wanted:
        train_heart()
    if "diabetes" in wanted:
        train_diabetes()
