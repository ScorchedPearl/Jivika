"""One inference service for every Jivika model.

Serves the same routes as the single-model apps (Brain.py, lung.py, wound_class.py,
xray_classifier.py, Heart.py) from one process, and adds /analyze, which works out
what kind of image it was given and runs the matching model.

Every image result carries a confidence, the full ranking of classes, and an
"uncertain" flag, so callers can tell a solid reading from a guess.
"""
import io
import json
import os
import threading
import time
import uuid

import cv2
import numpy as np
import torch
import torch.nn as nn
import xgboost as xgb
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image, ImageOps, UnidentifiedImageError
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from torchvision import models, transforms
from torchvision.transforms import functional as TF

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 15 * 1024 * 1024
os.makedirs("static", exist_ok=True)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Below these, a reading is reported as uncertain instead of as a finding
ROUTER_MIN_CONFIDENCE = 0.75
MIN_CONFIDENCE = 0.55
MIN_MARGIN = 0.15
# Below this the top answer is close to a coin toss between classes, so no finding is given
REJECT_CONFIDENCE = 0.35

# Scans are near-greyscale and photos are not; mean HSV saturation tells them apart
PHOTO_SATURATION = 0.25
SCAN_SATURATION = 0.04

HEATMAP_MAX_AGE_SECONDS = 3600

IMAGE_MODELS = {
    "router": {
        "weights": "resnet18_brain_tumor.pth",
        "classes": ["wound", "brain", "lung"],
        "dropout_head": False,
    },
    "brain": {
        "weights": "Brain_Xray_Classification.pth",
        "classes": ["glioma", "meningioma", "no_tumor", "pituitary"],
        "dropout_head": False,
        "title": "Brain MRI",
        "is_scan": True,
        "labels": {
            "glioma": "Glioma",
            "meningioma": "Meningioma",
            "no_tumor": "No tumour detected",
            "pituitary": "Pituitary tumour",
        },
        "about": "ResNet-18 trained on brain MRI scans, 4 classes. 99% validation accuracy in training.",
    },
    "lung": {
        "weights": "lung_xray_classify.pth",
        "classes": ["COVID", "HEALTHY", "PNEUMONIA"],
        "dropout_head": False,
        "title": "Chest X-ray",
        "is_scan": True,
        "labels": {
            "COVID": "COVID-19 pattern",
            "HEALTHY": "No sign of COVID-19 or pneumonia",
            "PNEUMONIA": "Pneumonia pattern",
        },
        "about": "ResNet-18 trained on chest X-rays, 3 classes. 95% test accuracy in training.",
    },
    "wound": {
        "weights": "woundd.pth",
        "classes": ["Abrasions", "Bruises", "Burns", "Cut", "Ingrown_nails", "Laceration", "Stab_wound"],
        "dropout_head": True,
        "title": "Wound photo",
        "is_scan": False,
        "labels": {
            "Abrasions": "Abrasion",
            "Bruises": "Bruise",
            "Burns": "Burn",
            "Cut": "Cut",
            "Ingrown_nails": "Ingrown nail",
            "Laceration": "Laceration",
            "Stab_wound": "Stab wound",
        },
        "about": "ResNet-18 trained on wound photos, 7 classes. 95% test accuracy in training.",
    },
}


def optional_json(path):
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        return json.load(f)


# Files made by Notebooks/jivika_image_models_colab.ipynb. Each one is used when it is present.
# calibration.json: a temperature per model, so a confidence of 80% is right about 80% of the time
TEMPERATURES = optional_json("calibration.json")
# eval_report.json: accuracy measured on held-out test images
EVAL_REPORT = optional_json("eval_report.json").get("models", {})
# ood_<kind>.npz: where each model's own training images sit in its feature space
DETECTORS = {
    kind: dict(np.load(f"ood_{kind}.npz"))
    for kind in ("brain", "lung", "wound")
    if os.path.exists(f"ood_{kind}.npz")
}
# router_v2.pth: a router that also knows "other", for images the app can't read
if os.path.exists("router_v2.pth"):
    IMAGE_MODELS["router"].update(weights="router_v2.pth", classes=["wound", "brain", "lung", "other"])
ROUTER_KNOWS_OTHER = "other" in IMAGE_MODELS["router"]["classes"]

for kind, measured in EVAL_REPORT.items():
    scores = measured["after_calibration"]
    if kind in IMAGE_MODELS and not measured.get("test_may_overlap_training"):
        IMAGE_MODELS[kind]["about"] = (
            f"ResNet-18, {len(IMAGE_MODELS[kind]['classes'])} classes. "
            f"Right on {scores['accuracy']:.0%} of {scores['images']} test images it had not seen."
        )

normalize = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


def build_model(spec):
    model = models.resnet18()
    head = nn.Linear(model.fc.in_features, len(spec["classes"]))
    model.fc = nn.Sequential(nn.Dropout(0.300665), head) if spec["dropout_head"] else head
    model.load_state_dict(torch.load(spec["weights"], map_location=device))
    model.to(device)
    model.eval()
    return model


loaded = {name: build_model(spec) for name, spec in IMAGE_MODELS.items()}
# Grad-CAM hooks into the model while it runs, so one request at a time
inference_lock = threading.Lock()


class BadImage(ValueError):
    pass


def read_image(file_storage):
    try:
        image = Image.open(io.BytesIO(file_storage.read()))
        # Phone photos store their rotation in EXIF; the models were trained on upright images
        image = ImageOps.exif_transpose(image)
        return image.convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise BadImage("That file isn't an image we can open.")


def standard_view(image):
    """The same crop the models were trained and tested on."""
    return TF.center_crop(TF.resize(image, 256), 224)


def test_views(image):
    """The standard crop plus two mild variations, to check the reading is stable."""
    base = standard_view(image)
    return [base, TF.hflip(base), TF.center_crop(TF.resize(image, 288), 224)]


def classify(name, image):
    spec = IMAGE_MODELS[name]
    batch = torch.stack([normalize(view) for view in test_views(image)]).to(device)
    with torch.no_grad():
        per_view = torch.softmax(loaded[name](batch) / TEMPERATURES.get(name, 1.0), dim=1).cpu().numpy()

    probabilities = per_view.mean(axis=0)
    order = np.argsort(probabilities)[::-1]
    top = int(order[0])
    labels = spec.get("labels", {})

    return {
        "index": top,
        "prediction": spec["classes"][top],
        "confidence": float(probabilities[top]),
        "margin": float(probabilities[top] - probabilities[order[1]]),
        "views_agree": bool((per_view.argmax(axis=1) == top).all()),
        "probabilities": [
            {
                "prediction": spec["classes"][i],
                "label": labels.get(spec["classes"][i], spec["classes"][i]),
                "score": round(float(probabilities[i]), 4),
            }
            for i in order
        ],
    }


def looks_unfamiliar(kind, image):
    """True when the image sits far from everything the model was trained on (Mahalanobis distance)."""
    detector = DETECTORS.get(kind)
    if detector is None:
        return False
    model = loaded[kind]
    body = nn.Sequential(*list(model.children())[:-1])
    with torch.no_grad():
        features = torch.flatten(body(normalize(standard_view(image)).unsqueeze(0).to(device)), 1).cpu().numpy()
    diff = features[:, None, :] - detector["means"][None, :, :]
    distance = np.einsum("ncd,de,nce->nc", diff, detector["precision"], diff).min()
    return bool(distance > detector["threshold"])


def image_stats(image):
    small = image.copy()
    small.thumbnail((256, 256))
    saturation = np.asarray(small.convert("HSV"))[:, :, 1].mean() / 255
    contrast = np.asarray(small.convert("L")).std()
    return {"saturation": float(saturation), "contrast": float(contrast), "min_side": min(image.size)}


def remove_old_heatmaps():
    cutoff = time.time() - HEATMAP_MAX_AGE_SECONDS
    for name in os.listdir("static"):
        path = os.path.join("static", name)
        if name.startswith("cam_") and os.path.getmtime(path) < cutoff:
            os.remove(path)


def save_heatmap(name, image, class_index):
    view = standard_view(image)
    input_tensor = normalize(view).unsqueeze(0).to(device)
    model = loaded[name]

    with GradCAM(model=model, target_layers=[model.layer4[-1]]) as cam:
        heatmap = cam(input_tensor=input_tensor, targets=[ClassifierOutputTarget(class_index)])

    # Drawn over the same crop the model saw, so the highlight lines up with the image
    overlay = show_cam_on_image(np.asarray(view).astype(np.float32) / 255, heatmap[0], use_rgb=True)

    remove_old_heatmaps()
    filename = f"cam_{uuid.uuid4().hex}.jpg"
    cv2.imwrite(os.path.join("static", filename), cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))
    return f"/static/{filename}"


def unsupported(reason, **extra):
    return {
        "supported": False,
        "kind": "unsupported",
        "title": "Image not recognised",
        "uncertain": True,
        "reasons": [reason],
        **extra,
    }


def read_with_model(kind, image):
    """Runs one specialist model and reports how far the result can be trusted."""
    spec = IMAGE_MODELS[kind]
    if looks_unfamiliar(kind, image):
        return unsupported(
            f"This doesn't look like the kind of {spec['title']} the model learned from, so a reading wouldn't be reliable.",
            kind_guess=kind,
        )
    result = classify(kind, image)

    if result["confidence"] < REJECT_CONFIDENCE:
        return unsupported(
            f"The {spec['title']} model couldn't match this image to anything it knows.",
            kind_guess=kind,
        )

    reasons = []
    if result["confidence"] < MIN_CONFIDENCE:
        reasons.append("The model isn't confident in any single answer.")
    elif result["margin"] < MIN_MARGIN:
        reasons.append("Two possibilities scored almost the same.")
    if not result["views_agree"]:
        reasons.append("The answer changed when the image was shifted slightly.")

    return {
        "supported": True,
        "kind": kind,
        "title": spec["title"],
        "prediction": result["prediction"],
        "label": spec["labels"][result["prediction"]],
        "confidence": round(result["confidence"], 4),
        "probabilities": result["probabilities"],
        "uncertain": bool(reasons),
        "reasons": reasons,
        "cam_image_url": save_heatmap(kind, image, result["index"]),
        "model": spec["about"],
    }


def analyze_image(image, kind=None):
    stats = image_stats(image)
    if stats["min_side"] < 96:
        return unsupported("The image is too small to read. Please share a larger one.")
    if stats["contrast"] < 8:
        return unsupported("The image looks blank or almost one colour.")

    routed = None
    if kind is None:
        routed = classify("router", image)
        kind = routed["prediction"]
        if kind == "other":
            return unsupported("This doesn't look like a brain MRI, chest X-ray or wound photo.")
        if routed["confidence"] < ROUTER_MIN_CONFIDENCE:
            return unsupported(
                "This doesn't look like a brain MRI, chest X-ray or wound photo.",
                kind_guess=kind,
                kind_confidence=round(routed["confidence"], 4),
            )

    # The first router only knows three kinds of image and leans on colour to tell them
    # apart, so its answer is checked against the colour of the image. A caller that names
    # the kind has already identified the image, and is trusted.
    spec = IMAGE_MODELS[kind]
    check_colour = routed and not ROUTER_KNOWS_OTHER
    if check_colour and spec["is_scan"] and stats["saturation"] > PHOTO_SATURATION:
        return unsupported(
            f"This looks like a colour photo, not a {spec['title']}.",
            kind_guess=kind,
        )
    if check_colour and not spec["is_scan"] and stats["saturation"] < SCAN_SATURATION:
        return unsupported(
            "This looks like a scan, but not a brain MRI or chest X-ray, which are the scans we can read.",
            kind_guess=kind,
        )

    result = read_with_model(kind, image)
    if routed:
        result["kind_confidence"] = round(routed["confidence"], 4)
    return result


def image_from_request():
    if "file" not in request.files:
        raise BadImage("No file provided")
    return read_image(request.files["file"])


def image_route(handler):
    try:
        image = image_from_request()
    except BadImage as e:
        return jsonify({"error": str(e)}), 400
    try:
        with inference_lock:
            return jsonify(handler(image))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "models": list(loaded) + ["heart", "diabetes"],
        "calibrated": sorted(TEMPERATURES),
        "detectors": sorted(DETECTORS),
        "router_knows_other": ROUTER_KNOWS_OTHER,
    })


@app.route("/analyze", methods=["POST"])
def analyze():
    kind = request.form.get("kind")
    if kind and kind not in ("brain", "lung", "wound"):
        return jsonify({"error": "kind must be brain, lung or wound"}), 400
    return image_route(lambda image: analyze_image(image, kind))


@app.route("/predict_classify", methods=["POST"])
def predict_classify():
    def handler(image):
        result = classify("router", image)
        return {
            "prediction": result["prediction"],
            "confidence": round(result["confidence"], 4),
            "probabilities": result["probabilities"],
        }

    return image_route(handler)


@app.route("/predict_brain", methods=["POST"])
def predict_brain():
    return image_route(lambda image: read_with_model("brain", image))


@app.route("/predict_lung", methods=["POST"])
def predict_lung():
    return image_route(lambda image: read_with_model("lung", image))


@app.route("/predict_wound", methods=["POST"])
def predict_wound():
    return image_route(lambda image: read_with_model("wound", image))


# ---- Risk models (heart, diabetes) ----

class RiskModel:
    """Boosted trees trained by training/train_risk_models.py. A blank answer is passed as NaN."""

    def __init__(self, name):
        self.booster = xgb.Booster(model_file=f"{name}_risk.json")
        with open(f"{name}_risk.meta.json") as f:
            self.meta = json.load(f)
        self.features = self.meta["features"]
        self.a = self.meta["calibration"]["a"]
        self.b = self.meta["calibration"]["b"]

    def _probability(self, margin):
        return float(1 / (1 + np.exp(-(self.a * margin + self.b))))

    def score(self, values):
        """Returns the calibrated probability and how hard each answer pushed it up or down (SHAP values)."""
        row = xgb.DMatrix(np.array([[values.get(name, np.nan) for name in self.features]], dtype=float))
        contributions = self.booster.predict(row, pred_contribs=True)[0]
        margin = float(contributions.sum())
        probability = self._probability(margin)
        # Kept in log-odds, where the answers add up; as percentages they shrink to nothing near 0% and 100%
        effects = {
            name: self.a * float(contributions[i])
            for i, name in enumerate(self.features)
            if not np.isnan(values.get(name, np.nan))
        }
        return probability, effects

    def accuracy(self, view):
        return self.meta["metrics"][view]


heart_model = RiskModel("heart")
diabetes_model = RiskModel("diabetes")


def read_number(data, key, low, high, required=True):
    value = data.get(key)
    if value in (None, ""):
        if required:
            raise ValueError(f"{key} is required")
        return np.nan
    value = float(value)
    if not low <= value <= high:
        raise ValueError(f"{key} must be between {low} and {high}")
    return value


def read_choice(data, key, codes, required=True):
    value = data.get(key)
    if value in (None, ""):
        if required:
            raise ValueError(f"{key} is required")
        return np.nan
    if value not in codes:
        raise ValueError(f"{key} must be one of {', '.join(map(str, codes))}")
    return codes[value]


def read_yes_no(data, key, required=True):
    value = data.get(key)
    if isinstance(value, str):
        value = {"yes": True, "no": False, "true": True, "false": False}.get(value.lower())
    if value is None:
        if required:
            raise ValueError(f"{key} is required")
        return np.nan
    return float(bool(value))


def top_factors(effects, describe, limit=6):
    factors = [
        {"label": describe[name], "effect": round(effect, 3)}
        for name, effect in effects.items()
        if abs(effect) >= 0.1 and name in describe
    ]
    return sorted(factors, key=lambda f: -abs(f["effect"]))[:limit]


# ---- Heart ----

SEX = {"F": 0, "M": 1}
CHEST_PAIN = {"ATA": 0, "NAP": 1, "TA": 2, "ASY": 3}
RESTING_ECG = {"Normal": 0, "ST": 1, "LVH": 2}
ST_SLOPE = {"Up": 0, "Flat": 1, "Down": 2}

CHEST_PAIN_LABELS = {0: "Atypical angina", 1: "Non-anginal chest pain", 2: "Typical angina", 3: "No chest pain"}
RESTING_ECG_LABELS = {0: "Normal resting ECG", 1: "ST-T changes on resting ECG", 2: "Signs of a thickened heart wall on ECG"}
ST_SLOPE_LABELS = {0: "Upsloping", 1: "Flat", 2: "Downsloping"}

STRESS_TEST = ("MaxHR", "ExerciseAngina", "Oldpeak", "ST_Slope")
# Codes used by the first heart model, still accepted as {"features": [5 numbers]}
OLD_CHEST_PAIN = {0: "ASY", 1: "ATA", 2: "NAP", 3: "TA"}
OLD_ST_SLOPE = {0: "Down", 1: "Flat", 2: "Up"}


def heart_values_from(data):
    if "features" in data:
        max_hr, chest_pain, cholesterol, oldpeak, st_slope = [float(x) for x in data["features"]]
        data = {
            "max_hr": max_hr, "chest_pain": OLD_CHEST_PAIN[int(chest_pain)], "cholesterol": cholesterol,
            "oldpeak": oldpeak, "st_slope": OLD_ST_SLOPE[int(st_slope)], "age": data.get("age"), "sex": data.get("sex"),
        }
        basics_required = False
    else:
        basics_required = True

    return {
        "Age": read_number(data, "age", 18, 100, basics_required),
        "Sex": read_choice(data, "sex", SEX, basics_required),
        "ChestPainType": read_choice(data, "chest_pain", CHEST_PAIN),
        "RestingBP": read_number(data, "resting_bp", 70, 250, False),
        "Cholesterol": read_number(data, "cholesterol", 80, 700, False),
        "FastingBS": read_yes_no(data, "high_fasting_sugar", False),
        "RestingECG": read_choice(data, "resting_ecg", RESTING_ECG, False),
        "MaxHR": read_number(data, "max_hr", 60, 220, False),
        "ExerciseAngina": read_yes_no(data, "exercise_angina", False),
        "Oldpeak": read_number(data, "oldpeak", -3, 7, False),
        "ST_Slope": read_choice(data, "st_slope", ST_SLOPE, False),
    }


def describe_heart(v):
    known = {name: value for name, value in v.items() if not np.isnan(value)}
    text = {
        "Age": lambda x: f"Age {x:g}",
        "Sex": lambda x: "Being male" if x else "Being female",
        "ChestPainType": lambda x: CHEST_PAIN_LABELS[int(x)],
        "RestingBP": lambda x: f"Resting blood pressure of {x:g} mmHg",
        "Cholesterol": lambda x: f"Cholesterol of {x:g} mg/dL",
        "FastingBS": lambda x: "Fasting blood sugar above 120 mg/dL" if x else "Normal fasting blood sugar",
        "RestingECG": lambda x: RESTING_ECG_LABELS[int(x)],
        "MaxHR": lambda x: f"Maximum heart rate of {x:g} bpm",
        "ExerciseAngina": lambda x: "Chest pain during exercise" if x else "No chest pain during exercise",
        "Oldpeak": lambda x: f"ST depression of {x:g}",
        "ST_Slope": lambda x: f"{ST_SLOPE_LABELS[int(x)]} ST segment",
    }
    return {name: text[name](value) for name, value in known.items()}


@app.route("/predict", methods=["POST"])
def predict_heart():
    try:
        values = heart_values_from(request.get_json(force=True))
    except (KeyError, TypeError, ValueError) as e:
        return jsonify({"error": str(e)}), 400

    probability, effects = heart_model.score(values)
    stress_given = [name for name in STRESS_TEST if not np.isnan(values[name])]
    measured = heart_model.accuracy("full" if len(stress_given) >= 3 else "no_stress_test")

    reasons = []
    if 0.4 <= probability <= 0.6:
        reasons.append("The score is close to the middle, so it could go either way.")

    notes = []
    if len(stress_given) < 3:
        notes.append(
            "No exercise ECG values were given, so this is a rougher estimate. "
            f"Without them the model was right for {measured['accuracy']:.0%} of patients, "
            f"against {heart_model.accuracy('full')['accuracy']:.0%} with them."
        )
    notes.append("The model learned from hospital patients being checked for heart disease, so it can overstate the risk for people with no symptoms.")

    return jsonify({
        "supported": True,
        "kind": "heart",
        "title": "Heart disease risk",
        "prediction": int(probability >= 0.5),
        "probability": round(probability, 4),
        "band": "low" if probability < 0.35 else "moderate" if probability < 0.65 else "high",
        "uncertain": bool(reasons),
        "reasons": reasons,
        "notes": notes,
        "factors": top_factors(effects, describe_heart(values)),
        "inputs": {name: (None if np.isnan(value) else value) for name, value in values.items()},
        "model": (
            f"Gradient-boosted trees trained on {heart_model.meta['people']} patients. "
            f"Right for {measured['accuracy']:.0%} of patients it had not seen (5-fold cross-validation)."
        ),
    })


# ---- Diabetes ----

GENERAL_HEALTH = {"excellent": 1, "very_good": 2, "good": 3, "fair": 4, "poor": 5}
GENERAL_HEALTH_LABELS = {1: "Excellent", 2: "Very good", 3: "Good", 4: "Fair", 5: "Poor"}
# Risk bands relative to the 14% of survey answers that reported diabetes or prediabetes
DIABETES_MODERATE = 0.10
DIABETES_HIGH = 0.25


def age_band(age):
    """The survey groups age in 5-year bands: 1 is 18-24, 2 is 25-29, up to 13 for 80 and over."""
    return 1 if age < 25 else min(13, int((age - 25) // 5) + 2)


def diabetes_values_from(data):
    if data.get("bmi") not in (None, ""):
        bmi = read_number(data, "bmi", 12, 98)
    else:
        height = read_number(data, "height_cm", 80, 250)
        weight = read_number(data, "weight_kg", 20, 350)
        bmi = weight / (height / 100) ** 2

    return {
        "Age": age_band(read_number(data, "age", 18, 110)),
        "Sex": read_choice(data, "sex", SEX),
        "BMI": round(bmi, 1),
        "HighBP": read_yes_no(data, "high_bp", False),
        "HighChol": read_yes_no(data, "high_cholesterol", False),
        "GenHlth": read_choice(data, "general_health", GENERAL_HEALTH),
        "PhysActivity": read_yes_no(data, "active"),
        "Smoker": read_yes_no(data, "smoker"),
        "HeartDiseaseorAttack": read_yes_no(data, "heart_disease"),
        "Stroke": read_yes_no(data, "stroke"),
        "DiffWalk": read_yes_no(data, "difficulty_walking"),
    }


def describe_diabetes(v, age):
    text = {
        "Age": f"Age {age:g}",
        "Sex": "Being male" if v["Sex"] else "Being female",
        "BMI": f"BMI of {v['BMI']:g}",
        "HighBP": "High blood pressure" if v["HighBP"] else "No high blood pressure",
        "HighChol": "High cholesterol" if v["HighChol"] else "No high cholesterol",
        "GenHlth": f"{GENERAL_HEALTH_LABELS[int(v['GenHlth'])]} general health",
        "PhysActivity": "Regular physical activity" if v["PhysActivity"] else "No regular physical activity",
        "Smoker": "Smoking history" if v["Smoker"] else "No smoking history",
        "HeartDiseaseorAttack": "History of heart disease" if v["HeartDiseaseorAttack"] else "No heart disease",
        "Stroke": "History of stroke" if v["Stroke"] else "No history of stroke",
        "DiffWalk": "Difficulty walking or climbing stairs" if v["DiffWalk"] else "No difficulty walking",
    }
    return {name: label for name, label in text.items() if not np.isnan(v[name])}


@app.route("/predict_diabetes", methods=["POST"])
def predict_diabetes():
    try:
        data = request.get_json(force=True)
        values = diabetes_values_from(data)
        age = float(data["age"])
    except (KeyError, TypeError, ValueError) as e:
        return jsonify({"error": str(e)}), 400

    probability, effects = diabetes_model.score(values)
    base_rate = diabetes_model.meta["base_rate"]
    unsure = [name for name in ("HighBP", "HighChol") if np.isnan(values[name])]
    measured = diabetes_model.accuracy("bp_and_cholesterol_unknown" if len(unsure) == 2 else "full")

    notes = [
        "This is a screening estimate from a questionnaire. Only a blood test (fasting glucose or HbA1c) can confirm or rule out diabetes.",
        "The model learned from a survey of US adults. People of South Asian descent tend to develop diabetes at a lower BMI, so it may understate your risk.",
    ]
    if unsure:
        notes.append("You weren't sure about your blood pressure or cholesterol, so the estimate is a little less precise.")

    return jsonify({
        "supported": True,
        "kind": "diabetes",
        "title": "Diabetes risk",
        "prediction": int(probability >= DIABETES_HIGH),
        "probability": round(probability, 4),
        "band": "low" if probability < DIABETES_MODERATE else "moderate" if probability < DIABETES_HIGH else "high",
        "uncertain": False,
        "reasons": [],
        "notes": notes,
        "factors": top_factors(effects, describe_diabetes(values, age)),
        "metrics": [
            {"label": "Your BMI", "value": f"{values['BMI']:g}"},
            {"label": "Survey average", "value": f"{base_rate:.0%}"},
            {"label": "Compared with average", "value": f"{probability / base_rate:.1f}×" if probability >= base_rate / 10 else "under 0.1×"},
        ],
        "inputs": {name: (None if np.isnan(value) else value) for name, value in values.items()},
        "model": (
            f"Gradient-boosted trees trained on {diabetes_model.meta['people']:,} survey answers. "
            f"Ranks a person with diabetes above one without {measured['auc']:.0%} of the time (5-fold cross-validation)."
        ),
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
