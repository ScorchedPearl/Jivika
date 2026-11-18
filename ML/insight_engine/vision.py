"""Trustworthy image diagnosis: uncertainty, OOD detection and multi-explainer saliency."""
from __future__ import annotations

import base64
import io
import math

import cv2
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image, ImageOps
from pytorch_grad_cam import GradCAM, GradCAMPlusPlus, LayerCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from torchvision import transforms

from .registry import DEVICE, VISION, VisionModel

MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]

_to_display = transforms.Compose([transforms.Resize(256), transforms.CenterCrop(224)])
_normalize = transforms.Compose([transforms.ToTensor(), transforms.Normalize(MEAN, STD)])

import os

REFERENCE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "reference")


# --------------------------------------------------------------------------- helpers
def load_image(data: bytes) -> Image.Image:
    return ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")


def _png_data_uri(rgb: np.ndarray) -> str:
    ok, buf = cv2.imencode(".png", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    assert ok
    return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode()


def _tta_views(img224: Image.Image) -> list[torch.Tensor]:
    """Label-preserving augmentations used to probe prediction stability."""
    views = [
        img224,
        img224.transpose(Image.FLIP_LEFT_RIGHT),
        img224.rotate(8, resample=Image.BILINEAR),
        img224.rotate(-8, resample=Image.BILINEAR),
        transforms.functional.adjust_brightness(img224, 1.15),
        transforms.functional.adjust_brightness(img224, 0.85),
        transforms.functional.adjust_contrast(img224, 1.2),
        transforms.functional.resized_crop(img224, 12, 12, 200, 200, [224, 224]),
    ]
    return [_normalize(v) for v in views]


def _entropy(p: np.ndarray, axis: int = -1) -> np.ndarray:
    return -(p * np.log(np.clip(p, 1e-12, 1.0))).sum(axis=axis)


# --------------------------------------------------------------------------- uncertainty
def predictive_distribution(vm: VisionModel, img224: Image.Image, mc_samples: int = 6) -> dict:
    """Bayesian-style ensemble over TTA views (and MC-dropout when the head has dropout).

    Total uncertainty H[E p] = aleatoric E[H p] + epistemic MI (BALD).
    """
    batch = torch.stack(_tta_views(img224)).to(DEVICE)
    feats: dict = {}
    hook = vm.model.avgpool.register_forward_hook(lambda m, i, o: feats.__setitem__("f", o.flatten(1)))
    with torch.no_grad():
        logits_clean = vm.model(batch[:1])
    hook.remove()
    with torch.no_grad():
        logit_sets = [vm.model(batch)]
        if vm.has_dropout:
            head = vm.model.fc
            head.train()  # enable dropout only in the classifier head
            try:
                for _ in range(mc_samples):
                    logit_sets.append(vm.model(batch))
            finally:
                head.eval()
    logits = torch.cat(logit_sets).cpu()
    probs = F.softmax(logits, dim=1).numpy()  # [S, C]

    mean_p = probs.mean(0)
    total = float(_entropy(mean_p))
    aleatoric = float(_entropy(probs).mean())
    epistemic = max(0.0, total - aleatoric)
    max_ent = math.log(len(vm.classes))

    votes = np.bincount(probs.argmax(1), minlength=len(vm.classes))
    top = int(mean_p.argmax())
    energy = float(-torch.logsumexp(logits_clean, dim=1).item())

    return {
        "classes": vm.classes,
        "probabilities": {c: float(p) for c, p in zip(vm.classes, mean_p)},
        "probability_std": {c: float(s) for c, s in zip(vm.classes, probs.std(0))},
        "prediction": vm.classes[top],
        "confidence": float(mean_p[top]),
        "samples": int(probs.shape[0]),
        "agreement": float(votes[top] / probs.shape[0]),
        "uncertainty": {
            "total": total / max_ent,
            "aleatoric": aleatoric / max_ent,
            "epistemic": epistemic / max_ent,
            "method": "TTA x8" + (f" + MC-dropout x{mc_samples}" if vm.has_dropout else ""),
        },
        "energy": energy,
        "features": feats["f"][0].numpy(),
        "top_index": top,
    }


def _synthetic_outliers(n: int = 24) -> list[Image.Image]:
    """Data-free outlier bank: images that are certainly not medical scans."""
    rng = np.random.default_rng(42)
    out = []
    yy, xx = np.mgrid[0:224, 0:224]
    for k in range(n):
        kind = k % 6
        if kind == 0:
            a = rng.random((224, 224, 3)) * 255
        elif kind == 1:
            a = np.ones((224, 224, 3)) * rng.integers(0, 256, 3)
        elif kind == 2:
            a = np.stack([(xx * c1 + yy * c2) % 256 for c1, c2 in rng.random((3, 2)) * 2], -1)
        elif kind == 3:
            sz = int(rng.integers(8, 48))
            a = (((xx // sz + yy // sz) % 2) * 255)[..., None].repeat(3, -1)
        elif kind == 4:
            a = cv2.GaussianBlur((rng.random((224, 224, 3)) * 255).astype(np.float32), (0, 0), float(rng.uniform(2, 8)))
            a = (a - a.min()) / (np.ptp(a) + 1e-6) * 255
        else:
            a = np.sin(xx / rng.uniform(3, 20))[..., None] * np.cos(yy / rng.uniform(3, 20))[..., None] * 127 + 128
            a = a.repeat(3, -1) * rng.random(3)
        out.append(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)))
    return out


def _penultimate(vm: VisionModel, batch: torch.Tensor) -> np.ndarray:
    feats: dict = {}
    h = vm.model.avgpool.register_forward_hook(lambda m, i, o: feats.__setitem__("f", o.flatten(1)))
    with torch.no_grad():
        logits = vm.model(batch)
    h.remove()
    return feats["f"].numpy(), logits.argmax(1).numpy()


def _calibrate() -> dict:
    """Builds the OOD detector for every model.

    Tier 1 (preferred) — class-conditional Mahalanobis distance (Lee et al.,
    NeurIPS 2018) on penultimate features, fitted on in-distribution reference
    images in ML/reference/<model>/ (>= 20 images). Threshold = 95th percentile
    of the reference set's own distances.

    Tier 2 (fallback, no reference data) — percentile rank of the feature norm
    against a bank of synthetic outliers. This reliably rejects junk (noise,
    flat colours, patterns) but cannot tell a natural non-medical photo from a
    real scan, so such images are reported as "unverified", never "verified".
    """
    bank = torch.stack([_normalize(im) for im in _synthetic_outliers(60)]).to(DEVICE)
    cal = {}
    for key, vm in VISION.items():
        bank_feats, _ = _penultimate(vm, bank)
        entry = {"bank_norms": np.sort(np.linalg.norm(bank_feats, axis=1))}
        ref_dir = os.path.join(REFERENCE_DIR, key)
        files = sorted(os.listdir(ref_dir)) if os.path.isdir(ref_dir) else []
        imgs = []
        for f in files:
            try:
                imgs.append(_normalize(_to_display(Image.open(os.path.join(ref_dir, f)).convert("RGB"))))
            except Exception:
                pass
        if len(imgs) >= 20:
            feats, preds = _penultimate(vm, torch.stack(imgs).to(DEVICE))
            means = {c: feats[preds == c].mean(0) for c in np.unique(preds)}
            centred = np.concatenate([feats[preds == c] - m for c, m in means.items()])
            cov = np.cov(centred, rowvar=False) + 1e-3 * np.eye(feats.shape[1])
            prec = np.linalg.inv(cov)
            d = np.array([min(float((f - m) @ prec @ (f - m)) for m in means.values()) for f in feats])
            entry.update(means=means, precision=prec, threshold=float(np.percentile(d, 95)), n_ref=len(imgs))
        cal[key] = entry
    return cal


OOD_CAL = _calibrate()


def ood_assessment(model_key: str, features: np.ndarray, energy: float) -> dict:
    cal = OOD_CAL[model_key]
    if "precision" in cal:
        d = min(float((features - m) @ cal["precision"] @ (features - m)) for m in cal["means"].values())
        ratio = d / cal["threshold"]
        if ratio <= 1.0:
            status, msg = "in_distribution", "Image matches the model's reference training distribution."
        elif ratio <= 1.5:
            status, msg = "borderline", "Image is atypical for this model; treat the result with caution."
        else:
            status, msg = "out_of_distribution", "Image looks unlike anything this model was trained on."
        familiarity = float(np.clip(1.5 - ratio, 0, 1))
        return {"status": status, "message": msg, "familiarity": familiarity, "energy": energy,
                "score": ratio, "method": f"Mahalanobis (fitted on {cal['n_ref']} reference images)"}

    norm = float(np.linalg.norm(features))
    pct = float(np.searchsorted(cal["bank_norms"], norm) / len(cal["bank_norms"]))
    if pct < 0.5:
        status, msg = "out_of_distribution", "Image responds like synthetic junk (noise / flat / pattern), not a medical image."
        familiarity = pct
    else:
        status, msg = "unverified", ("Passes the junk filter, but no reference scans are installed to verify it "
                                     "matches the training distribution. Add images under ML/reference/ to enable Mahalanobis OOD.")
        familiarity = 0.5
    return {"status": status, "message": msg, "familiarity": familiarity, "energy": energy,
            "score": pct, "method": "Feature-norm percentile vs synthetic outlier bank"}


# --------------------------------------------------------------------------- explainability
def _top_mask(cam: np.ndarray, q: float = 0.85) -> np.ndarray:
    return cam >= np.quantile(cam, q)


def _iou(a: np.ndarray, b: np.ndarray) -> float:
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    return float(inter / union) if union else 0.0


def occlusion_map(vm: VisionModel, x: torch.Tensor, cls: int, grid: int = 8) -> np.ndarray:
    """Counterfactual saliency: confidence drop when each patch is greyed out."""
    patch = 224 // grid
    with torch.no_grad():
        base = F.softmax(vm.model(x), 1)[0, cls].item()
        batch = []
        for i in range(grid):
            for j in range(grid):
                xo = x.clone()
                xo[:, :, i * patch:(i + 1) * patch, j * patch:(j + 1) * patch] = 0.0
                batch.append(xo)
        probs = F.softmax(vm.model(torch.cat(batch)), 1)[:, cls].numpy()
    drop = np.clip(base - probs, 0, None).reshape(grid, grid)
    m = cv2.resize(drop.astype(np.float32), (224, 224), interpolation=cv2.INTER_CUBIC)
    m = np.clip(m, 0, None)
    return m / m.max() if m.max() > 0 else m


def deletion_curve(vm: VisionModel, x: torch.Tensor, cls: int, cam: np.ndarray, steps: int = 10) -> dict:
    """Faithfulness test (Petsiuk et al.): delete the most-salient pixels first and
    watch the confidence fall. Compare against deleting random pixels."""
    order = np.argsort(-cam.ravel())
    rng = np.random.default_rng(0)
    rand_order = rng.permutation(order.size)
    fracs = np.linspace(0, 1, steps + 1)
    batch_s, batch_r = [], []
    for f in fracs:
        k = int(f * order.size)
        for ord_, out in ((order, batch_s), (rand_order, batch_r)):
            mask = np.ones(order.size, dtype=np.float32)
            mask[ord_[:k]] = 0.0
            m = torch.from_numpy(mask.reshape(1, 1, 224, 224))
            out.append(x * m)
    with torch.no_grad():
        ps = F.softmax(vm.model(torch.cat(batch_s)), 1)[:, cls].numpy()
        pr = F.softmax(vm.model(torch.cat(batch_r)), 1)[:, cls].numpy()
    auc_s = float(np.trapezoid(ps, fracs))
    auc_r = float(np.trapezoid(pr, fracs))
    # >0 means the explanation points at pixels the model really depends on.
    faithfulness = float(np.clip((auc_r - auc_s) / max(auc_r, 1e-6), -1, 1))
    return {
        "fractions": fracs.tolist(),
        "salient": ps.tolist(),
        "random": pr.tolist(),
        "auc_salient": auc_s,
        "auc_random": auc_r,
        "faithfulness": faithfulness,
    }


def explain(vm: VisionModel, img224: Image.Image, cls: int) -> dict:
    x = _normalize(img224).unsqueeze(0).to(DEVICE)
    rgb = np.asarray(img224).astype(np.float32) / 255.0
    targets = [ClassifierOutputTarget(cls)]

    cams: dict[str, np.ndarray] = {}
    for name, Method in (("gradcam", GradCAM), ("gradcam_pp", GradCAMPlusPlus), ("layercam", LayerCAM)):
        with Method(model=vm.model, target_layers=[vm.target_layer]) as cam:
            cams[name] = cam(input_tensor=x, targets=targets)[0]
    cams["occlusion"] = occlusion_map(vm, x, cls)

    names = list(cams)
    masks = {n: _top_mask(cams[n]) for n in names}
    pairs = [(a, b) for i, a in enumerate(names) for b in names[i + 1:]]
    pairwise = {f"{a}|{b}": _iou(masks[a], masks[b]) for a, b in pairs}
    agreement = float(np.mean(list(pairwise.values())))

    consensus = np.mean([cams[n] for n in names], axis=0)
    consensus = consensus / consensus.max() if consensus.max() > 0 else consensus
    focus_area = float(_top_mask(consensus, 0.5).mean())  # fraction of image above median

    overlays = {n: _png_data_uri(show_cam_on_image(rgb, cams[n], use_rgb=True)) for n in names}
    overlays["consensus"] = _png_data_uri(show_cam_on_image(rgb, consensus, use_rgb=True))

    return {
        "original": _png_data_uri((rgb * 255).astype(np.uint8)),
        "overlays": overlays,
        "explainer_agreement": agreement,
        "pairwise_iou": pairwise,
        "deletion": deletion_curve(vm, x, cls, consensus),
        "focus_entropy": float(_entropy((consensus / consensus.sum()).ravel()) / math.log(consensus.size)),
        "focus_area": focus_area,
    }


# --------------------------------------------------------------------------- trust + triage
def trust_score(pred: dict, ood: dict, expl: dict) -> dict:
    components = {
        "confidence": pred["confidence"],
        "stability": pred["agreement"],
        "low_epistemic": 1 - min(1.0, pred["uncertainty"]["epistemic"] * 4),
        "familiarity": ood["familiarity"],
        "explainer_agreement": expl["explainer_agreement"],
        "faithfulness": max(0.0, expl["deletion"]["faithfulness"]),
    }
    weights = {"confidence": .2, "stability": .2, "low_epistemic": .15,
               "familiarity": .2, "explainer_agreement": .1, "faithfulness": .15}
    score = sum(components[k] * w for k, w in weights.items())
    if ood["status"] == "out_of_distribution":
        score = min(score, 0.25)
    return {"score": float(score), "components": components, "weights": weights}


def triage(vm: VisionModel, pred: dict, trust: dict, ood: dict) -> dict:
    # Expected severity under the predictive distribution, not just the argmax.
    exp_sev = sum(pred["probabilities"][c] * vm.severity.get(c, 0.5) for c in vm.classes)
    if ood["status"] == "out_of_distribution":
        level, action = "abstain", "The AI abstains: please upload a clear scan of the right type or see a clinician."
    elif trust["score"] < 0.5:
        level, action = "review", "Low-trust result — route to a radiologist / doctor for human review."
    elif exp_sev >= 0.6:
        level, action = "urgent", "Findings suggest a serious condition — book a specialist consultation promptly."
    elif exp_sev >= 0.3:
        level, action = "attention", "Findings merit a routine doctor visit."
    else:
        level, action = "routine", "No significant finding detected by the model."
    return {"level": level, "expected_severity": float(exp_sev), "action": action}


# --------------------------------------------------------------------------- pipeline
def analyze(data: bytes, modality: str | None = None) -> dict:
    img = load_image(data)
    img224 = _to_display(img)

    router = VISION["router"]
    route = predictive_distribution(router, img224)
    chosen = modality if modality in ("brain", "lung", "wound") else route["prediction"]
    vm = VISION[chosen]

    pred = predictive_distribution(vm, img224)
    ood = ood_assessment(chosen, pred.pop("features"), pred["energy"])
    route.pop("features")
    expl = explain(vm, img224, pred["top_index"])
    trust = trust_score(pred, ood, expl)

    pred.pop("top_index")
    route.pop("top_index")
    return {
        "modality": {
            "selected": chosen,
            "auto_detected": route["prediction"],
            "overridden": bool(modality) and modality != route["prediction"],
            "probabilities": route["probabilities"],
        },
        "model": vm.title,
        "prediction": pred,
        "ood": ood,
        "explanation": expl,
        "trust": trust,
        "triage": triage(vm, pred, trust, ood),
    }
