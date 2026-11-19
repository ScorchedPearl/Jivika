"""Calls the ML models and returns one "analysis" shape for every kind of result.

With ML_SERVICE_URL set, the unified service in ML/service.py is used and results
carry confidence and alternatives. Without it, the hosted single-model endpoints
are used, which only return a label.
"""
import base64
import json
import uuid
import requests
from urllib.parse import urljoin
from langchain_core.messages import HumanMessage
from .prompts import imageTypePrompt
from .clients import (
    llm_client, s3Client, AWS_DEFAULT_REGION, BUCKET_NAME, rich, ML_SERVICE_URL, IMAGE_TYPE_CHECK,
    XRAY_CLASSIFIER_URL, BRAIN_MODEL_URL, LUNG_MODEL_URL, WOUND_MODEL_URL, HEART_MODEL_URL
)

TIMEOUT = 90

HOSTED_MODELS = {
    "brain": (BRAIN_MODEL_URL, "brain MRI"),
    "lung": (LUNG_MODEL_URL, "chest X-ray"),
    "wound": (WOUND_MODEL_URL, "wound photo"),
}

# What the vision LLM calls each image type, and the model that reads it
IMAGE_TYPES = {"brain_mri": "brain", "chest_xray": "lung", "wound_photo": "wound"}

# Category codes the heart model was trained with
CHEST_PAIN = {"ASY": 0, "ATA": 1, "NAP": 2, "TA": 3}
ST_SLOPE = {"Down": 0, "Flat": 1, "Up": 2}


def unsupported(reason):
    return {
        "supported": False,
        "kind": "unsupported",
        "title": "Image not recognised",
        "uncertain": True,
        "reasons": [reason],
    }


def _post_image(url, image_bytes, **fields):
    files = {"file": ("image.jpg", image_bytes, "image/jpeg")}
    response = requests.post(url, files=files, data=fields, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()


def _store_heatmap(model_url, cam_path):
    """Copies the model's heatmap to S3 so the browser can load it."""
    try:
        cam_response = requests.get(urljoin(model_url, cam_path), timeout=TIMEOUT)
        cam_response.raise_for_status()
        CAM_OBJECT_NAME = f"images/cam/{uuid.uuid4().hex}.jpg"
        s3Client.put_object(
            Body=cam_response.content,
            Bucket=BUCKET_NAME,
            Key=CAM_OBJECT_NAME,
            ContentType="image/jpeg"
        )
        return f"https://{BUCKET_NAME}.s3.{AWS_DEFAULT_REGION}.amazonaws.com/{CAM_OBJECT_NAME}"
    except Exception as e:
        rich.print(f"[red]CAM Image Upload Error: {e}[/red]")
        return None


def check_image_type(image_bytes):
    """Asks the vision LLM what the image shows.

    The diagnosis models answer with one of their own classes whatever they are
    given, so this is what stops a holiday photo coming back as a disease.
    Returns None when the check is off or fails, and the ML router decides instead.
    """
    if not IMAGE_TYPE_CHECK:
        return None
    try:
        encoded = base64.b64encode(image_bytes).decode()
        response = llm_client.invoke(
            [HumanMessage(content=[
                {"type": "text", "text": imageTypePrompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encoded}"}},
            ])],
            config={"tags": ["nostream"]},
        )
        text = response.content.strip().removeprefix("```json").removesuffix("```")
        verdict = json.loads(text)
        if verdict.get("type") not in (*IMAGE_TYPES, "other"):
            return None
        return verdict
    except Exception as e:
        rich.print(f"[yellow]Image type check skipped: {e}[/yellow]")
        return None


def _hosted_image_analysis(image_bytes, kind=None):
    kind = kind or str(_post_image(XRAY_CLASSIFIER_URL, image_bytes).get("prediction", "")).lower()
    if kind not in HOSTED_MODELS:
        return unsupported("This doesn't look like a brain MRI, chest X-ray or wound photo."), None

    model_url, title = HOSTED_MODELS[kind]
    result = _post_image(model_url, image_bytes)
    prediction = result.get("prediction")
    return {
        "supported": True,
        "kind": kind,
        "title": title[0].upper() + title[1:],
        "prediction": prediction,
        "label": str(prediction).replace("_", " "),
        "confidence": None,
        "probabilities": [],
        "uncertain": False,
        "reasons": [],
        "cam_image_url": result.get("cam_image_url"),
    }, model_url


def analyze_image(image_url, report_progress=lambda text: None):
    response = requests.get(image_url, timeout=TIMEOUT)
    response.raise_for_status()
    image_bytes = response.content

    verdict = check_image_type(image_bytes)
    if verdict and verdict["type"] == "other":
        seen = f" It appears to show: {verdict['note'].rstrip('.')}." if verdict.get("note") else ""
        result = unsupported("This doesn't look like a brain MRI, chest X-ray or wound photo." + seen)
        result["image_url"] = image_url
        return result
    kind = IMAGE_TYPES[verdict["type"]] if verdict else None
    if kind:
        report_progress(f"Reading your {HOSTED_MODELS[kind][1]}")

    if ML_SERVICE_URL:
        model_url = ML_SERVICE_URL
        fields = {"kind": kind} if kind else {}
        result = _post_image(urljoin(ML_SERVICE_URL, "/analyze"), image_bytes, **fields)
    else:
        result, model_url = _hosted_image_analysis(image_bytes, kind)

    if verdict and not verdict.get("clear", True) and result.get("supported"):
        result["uncertain"] = True
        result.setdefault("reasons", []).append("The image is hard to make out.")

    cam_path = result.pop("cam_image_url", None)
    result["image_url"] = image_url
    result["heatmap_url"] = _store_heatmap(model_url, cam_path) if cam_path else None
    return result


def _risk_check(path, payload, name):
    response = requests.post(urljoin(ML_SERVICE_URL, path), json=payload, timeout=TIMEOUT)
    if response.status_code == 400:
        raise ValueError(response.json().get("error", f"Invalid {name} inputs"))
    response.raise_for_status()
    return response.json()


def diabetes_check(features):
    """features: the answers from the diabetes form."""
    if not ML_SERVICE_URL:
        raise ValueError("The diabetes model needs the ML service")
    return _risk_check("/predict_diabetes", features, "diabetes")


def heart_check(features):
    """features: named fields from the heart form, or the 5 raw numbers of the first model."""
    if ML_SERVICE_URL:
        payload = features if isinstance(features, dict) else {"features": features}
        return _risk_check("/predict", payload, "heart")

    if isinstance(features, dict):
        features = [
            float(features["max_hr"]),
            CHEST_PAIN[features["chest_pain"]],
            float(features.get("cholesterol") or 223),
            float(features["oldpeak"]),
            ST_SLOPE[features["st_slope"]],
        ]
    response = requests.post(HEART_MODEL_URL, json={"features": features}, timeout=TIMEOUT)
    response.raise_for_status()
    prediction = response.json().get("prediction")
    return {
        "supported": True,
        "kind": "heart",
        "title": "Heart disease risk",
        "prediction": prediction,
        "probability": None,
        "band": "high" if prediction == 1 else "low",
        "uncertain": False,
        "reasons": [],
        "factors": [],
    }
