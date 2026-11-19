"""Explainable heart-risk analysis on top of the soft-voting ensemble (LR + RF + XGBoost).

* exact Shapley values (all 2^5 coalitions, baseline Shapley w.r.t. a population
  reference patient) — no sampling approximation as in KernelSHAP
* ensemble disagreement: per-member probabilities and their spread
* counterfactual recourse: the smallest *actionable* change (MaxHR, Cholesterol,
  Oldpeak) that moves predicted risk below the decision threshold
* what-if curves: risk as each feature sweeps its clinical range
"""
from __future__ import annotations

import itertools
import math
import warnings

import numpy as np
import pandas as pd

import os

import joblib

# NOTE: this module must never import torch. XGBoost and PyTorch ship separate
# OpenMP runtimes that deadlock/segfault when loaded into one process on macOS,
# so the server runs this module in an isolated worker process.
HEART_FEATURES = ["MaxHR", "ChestPainType", "Cholesterol", "Oldpeak", "ST_Slope"]
_MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Heart_model.pkl")
_model = None


def _get_model():
    global _model
    if _model is None:  # lazy: only ever loaded inside the worker process
        _model = joblib.load(_MODEL_PATH)
    return _model

warnings.filterwarnings("ignore")

# Encodings follow LabelEncoder on the Kaggle "heart failure prediction" dataset.
CHEST_PAIN = {0: "Asymptomatic (ASY)", 1: "Atypical angina (ATA)", 2: "Non-anginal pain (NAP)", 3: "Typical angina (TA)"}
ST_SLOPE = {0: "Down", 1: "Flat", 2: "Up"}

# Population reference patient (dataset medians / modes) used as the Shapley baseline.
REFERENCE = {"MaxHR": 138.0, "ChestPainType": 0.0, "Cholesterol": 223.0, "Oldpeak": 0.6, "ST_Slope": 1.0}

RANGES = {
    "MaxHR": (60, 202, 2),
    "ChestPainType": (0, 3, 1),
    "Cholesterol": (85, 603, 5),
    "Oldpeak": (-2.6, 6.2, 0.1),
    "ST_Slope": (0, 2, 1),
}
# Actionable features with a per-unit "effort" scale (one clinically meaningful step).
ACTIONABLE = {"MaxHR": 10.0, "Cholesterol": 25.0, "Oldpeak": 0.5}


def _proba(rows: np.ndarray) -> np.ndarray:
    df = pd.DataFrame(rows, columns=HEART_FEATURES)
    return _get_model().predict_proba(df)[:, 1]


def exact_shapley(x: np.ndarray) -> dict:
    n = len(HEART_FEATURES)
    ref = np.array([REFERENCE[f] for f in HEART_FEATURES])
    coalitions = list(itertools.product([0, 1], repeat=n))
    rows = np.array([np.where(np.array(c, bool), x, ref) for c in coalitions])
    v = dict(zip(coalitions, _proba(rows)))
    phi = np.zeros(n)
    for i in range(n):
        for c in coalitions:
            if c[i]:
                continue
            s = sum(c)
            w = math.factorial(s) * math.factorial(n - s - 1) / math.factorial(n)
            with_i = tuple(1 if j == i else c[j] for j in range(n))
            phi[i] += w * (v[with_i] - v[c])
    base = v[tuple([0] * n)]
    full = v[tuple([1] * n)]
    return {
        "base_value": float(base),
        "prediction": float(full),
        "values": {f: float(p) for f, p in zip(HEART_FEATURES, phi)},
        "efficiency_check": float(base + phi.sum() - full),  # ~0 by construction
        "reference": REFERENCE,
    }


def ensemble_breakdown(x: np.ndarray) -> dict:
    df = pd.DataFrame([x], columns=HEART_FEATURES)
    names = {"lr": "Logistic regression", "rf": "Random forest", "xg": "XGBoost"}
    members = {}
    for (name, _), est in zip(_get_model().estimators, _get_model().estimators_):
        members[names.get(name, name)] = float(est.predict_proba(df)[0, 1])
    vals = np.array(list(members.values()))
    return {
        "members": members,
        "spread": float(vals.std()),
        "consensus": bool((vals > 0.5).all() or (vals <= 0.5).all()),
    }


def what_if_curves(x: np.ndarray) -> dict:
    out = {}
    for i, f in enumerate(HEART_FEATURES):
        lo, hi, step = RANGES[f]
        grid = np.arange(lo, hi + step / 2, step if f not in ("Cholesterol", "MaxHR") else step * 3)
        rows = np.repeat(x[None, :], len(grid), 0)
        rows[:, i] = grid
        out[f] = {"x": grid.round(2).tolist(), "risk": _proba(rows).round(4).tolist()}
    return out


def recourse(x: np.ndarray, threshold: float = 0.5) -> dict:
    """Grid search over actionable features for the minimum-effort change below threshold."""
    p0 = float(_proba(x[None, :])[0])
    if p0 < threshold:
        return {"needed": False, "current_risk": p0}
    idx = {f: HEART_FEATURES.index(f) for f in ACTIONABLE}
    steps = {
        "MaxHR": np.arange(0, 31, 5),            # raise fitness-related max HR (<= +30 bpm)
        "Cholesterol": np.arange(0, -101, -10),  # lower cholesterol (<= -100 mg/dl)
        "Oldpeak": np.round(np.arange(0, -3.01, -0.2), 2),  # reduce ST depression
    }
    grids = np.array(list(itertools.product(*steps.values())))
    rows = np.repeat(x[None, :], len(grids), 0).astype(float)
    for k, f in enumerate(ACTIONABLE):
        rows[:, idx[f]] += grids[:, k]
    rows[:, idx["MaxHR"]] = np.clip(rows[:, idx["MaxHR"]], *RANGES["MaxHR"][:2])
    rows[:, idx["Cholesterol"]] = np.clip(rows[:, idx["Cholesterol"]], *RANGES["Cholesterol"][:2])
    rows[:, idx["Oldpeak"]] = np.clip(rows[:, idx["Oldpeak"]], 0 if x[idx["Oldpeak"]] >= 0 else -2.6, None)
    rows = np.round(rows, 2)  # score exactly the values we will show the user (tree splits are sharp)
    risk = _proba(rows)
    effort = np.abs(grids / np.array(list(ACTIONABLE.values()))).sum(1)
    ok = risk < threshold
    if not ok.any():
        best = int(risk.argmin())
        return {"needed": True, "found": False, "current_risk": p0, "best_risk": float(risk[best]),
                "changes": _changes(x, rows[best], idx)}
    cand = np.where(ok)[0]
    best = int(cand[np.lexsort((risk[cand], effort[cand]))[0]])
    return {"needed": True, "found": True, "current_risk": p0, "new_risk": float(risk[best]),
            "effort": float(effort[best]), "changes": _changes(x, rows[best], idx)}


def _changes(x, row, idx):
    return [{"feature": f, "from": float(x[i]), "to": float(round(row[i], 2))}
            for f, i in idx.items() if abs(row[i] - x[i]) > 1e-9]


def analyze(features: dict) -> dict:
    x = np.array([float(features[f]) for f in HEART_FEATURES])
    risk = float(_proba(x[None, :])[0])
    ens = ensemble_breakdown(x)
    return {
        "risk": risk,
        "prediction": int(risk >= 0.5),
        "label": "Elevated heart-disease risk" if risk >= 0.5 else "Lower heart-disease risk",
        "ensemble": ens,
        "shapley": exact_shapley(x),
        "recourse": recourse(x),
        "what_if": what_if_curves(x),
        "encodings": {"ChestPainType": CHEST_PAIN, "ST_Slope": ST_SLOPE},
    }
