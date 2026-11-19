"""Health checks that are plain arithmetic against published guidelines, no model needed."""

# WHO adult BMI categories
BMI_SCALE = [
    {"label": "Underweight", "to": 18.5},
    {"label": "Healthy weight", "to": 25},
    {"label": "Overweight", "to": 30},
    {"label": "Obese", "to": None},
]

# 2017 ACC/AHA adult blood pressure categories
BP_CATEGORIES = ["Low", "Normal", "Elevated", "High (stage 1)", "High (stage 2)", "Hypertensive crisis"]


def _number(features, key, low, high):
    try:
        value = float(features[key])
    except (KeyError, TypeError, ValueError):
        raise ValueError(f"{key} is missing or not a number")
    if not low <= value <= high:
        raise ValueError(f"{key} must be between {low} and {high}")
    return value


def bmi_check(features):
    height_cm = _number(features, "height_cm", 80, 250)
    weight_kg = _number(features, "weight_kg", 20, 350)
    bmi = round(weight_kg / (height_cm / 100) ** 2, 1)

    label = next(band["label"] for band in BMI_SCALE if band["to"] is None or bmi < band["to"])

    notes = []
    age = features.get("age")
    if age is not None and float(age) < 18:
        notes.append("These categories are for adults. Children and teenagers need age-based growth charts.")
    if 23 <= bmi < 25:
        notes.append("For people of South Asian descent, health risks start to rise from a BMI of 23.")
    notes.append("BMI doesn't separate muscle from fat, so it can mislead for very muscular people.")

    healthy_low = round(18.5 * (height_cm / 100) ** 2, 1)
    healthy_high = round(24.9 * (height_cm / 100) ** 2, 1)

    return {
        "supported": True,
        "kind": "bmi",
        "title": "Body mass index",
        "label": label,
        "value": bmi,
        "unit": "kg/m²",
        "scale": {"min": 14, "max": 40, "bands": BMI_SCALE},
        "metrics": [
            {"label": "Height", "value": f"{height_cm:g} cm"},
            {"label": "Weight", "value": f"{weight_kg:g} kg"},
            {"label": "Healthy range for your height", "value": f"{healthy_low:g}–{healthy_high:g} kg"},
        ],
        "uncertain": False,
        "reasons": [],
        "notes": notes,
        "model": "Calculated from height and weight using WHO adult categories.",
    }


def blood_pressure_check(features):
    systolic = _number(features, "systolic", 50, 300)
    diastolic = _number(features, "diastolic", 30, 200)
    if diastolic >= systolic:
        raise ValueError("The upper number (systolic) should be higher than the lower number (diastolic)")

    if systolic > 180 or diastolic > 120:
        label = "Hypertensive crisis"
    elif systolic >= 140 or diastolic >= 90:
        label = "High (stage 2)"
    elif systolic >= 130 or diastolic >= 80:
        label = "High (stage 1)"
    elif systolic >= 120:
        label = "Elevated"
    elif systolic < 90 or diastolic < 60:
        label = "Low"
    else:
        label = "Normal"

    notes = ["One reading isn't a diagnosis. Blood pressure is judged on several readings taken on different days."]
    if label == "Hypertensive crisis":
        notes.insert(0, "Rest for five minutes and measure again. If it is still this high, get medical help today. "
                        "Call emergency services if you also have chest pain, breathlessness, weakness or trouble speaking.")

    metrics = [
        {"label": "Systolic (upper)", "value": f"{systolic:g} mmHg"},
        {"label": "Diastolic (lower)", "value": f"{diastolic:g} mmHg"},
    ]
    heart_rate = features.get("heart_rate")
    if heart_rate not in (None, ""):
        metrics.append({"label": "Heart rate", "value": f"{float(heart_rate):g} bpm"})

    return {
        "supported": True,
        "kind": "bp",
        "title": "Blood pressure",
        "label": label,
        "value": f"{systolic:g}/{diastolic:g}",
        "unit": "mmHg",
        "steps": {"labels": BP_CATEGORIES, "current": BP_CATEGORIES.index(label)},
        "metrics": metrics,
        "uncertain": False,
        "reasons": [],
        "notes": notes,
        "urgent": label == "Hypertensive crisis",
        "model": "Classified with the 2017 ACC/AHA adult blood pressure categories.",
    }


CHECKS = {"bmi": bmi_check, "bloodpressure": blood_pressure_check}
