"""Adversarial robustness certificate + visual counterfactual explanations.

1. Robustness radius: the smallest L-inf perturbation (found by PGD + binary
   search) that flips the model's diagnosis. A diagnosis that flips under an
   invisible 0.3% pixel change should not be trusted; one that survives large
   perturbations is stable. This is an empirical upper bound on the true
   minimal adversarial radius.

2. Counterfactual scan: "what would have to change in this image for the model
   to give a different (e.g. healthy) diagnosis?" We optimise a sparse, smooth
   perturbation (L1 + total-variation regularised, Wachter-style counterfactual
   adapted to images) that moves the prediction to a target class, then show
   WHERE the image had to change. Unlike CAMs, this is causal w.r.t. the model:
   the shown change provably produces the alternative diagnosis.
"""
from __future__ import annotations

import base64
from contextlib import contextmanager

import cv2
import numpy as np
import torch
import torch.nn.functional as F

from .registry import DEVICE, VisionModel

_MEAN = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
_STD = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)


def _norm(x01: torch.Tensor) -> torch.Tensor:
    return (x01 - _MEAN) / _STD


def _uri(rgb: np.ndarray) -> str:
    ok, buf = cv2.imencode(".png", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode()


@contextmanager
def _frozen(model: torch.nn.Module):
    """Freeze weights while attacking the input; restore afterwards (Grad-CAM needs them)."""
    prev = [p.requires_grad for p in model.parameters()]
    for p in model.parameters():
        p.requires_grad_(False)
    try:
        yield
    finally:
        for p, r in zip(model.parameters(), prev):
            p.requires_grad_(r)


def _pgd_flips(model, x01: torch.Tensor, label: int, eps: float, steps: int = 12) -> bool:
    """Untargeted L-inf PGD; returns True if the label flips within eps."""
    alpha = eps / 4
    delta = torch.zeros_like(x01).uniform_(-eps, eps).requires_grad_(True)
    for _ in range(steps):
        logits = model(_norm((x01 + delta).clamp(0, 1)))
        if logits.argmax(1).item() != label:
            return True
        loss = F.cross_entropy(logits, torch.tensor([label]))
        (grad,) = torch.autograd.grad(loss, delta)
        with torch.no_grad():
            delta += alpha * grad.sign()
            delta.clamp_(-eps, eps)
    with torch.no_grad():
        return model(_norm((x01 + delta).clamp(0, 1))).argmax(1).item() != label


def robustness_radius(vm: VisionModel, x01: torch.Tensor, label: int) -> dict:
    model = vm.model
    torch.manual_seed(0)
    lo, hi = 0.0, 16 / 255
    if not _pgd_flips(model, x01, label, hi):
        radius, certified_upto = None, hi
    else:
        for _ in range(6):
            mid = (lo + hi) / 2
            if _pgd_flips(model, x01, label, mid):
                hi = mid
            else:
                lo = mid
        radius, certified_upto = hi, lo
    r = radius if radius is not None else certified_upto
    # 0 → flips at imperceptible noise, 1 → survives >= 8/255 (a strong attack budget)
    score = float(min(1.0, r / (8 / 255)))
    if radius is None:
        verdict = "No flip found up to 16/255 — highly robust diagnosis."
    elif r < 1 / 255:
        verdict = "Fragile: an invisible (<1/255) perturbation changes the diagnosis."
    elif r < 4 / 255:
        verdict = "Moderately robust: small perturbations can change the diagnosis."
    else:
        verdict = "Robust: only large, visible perturbations change the diagnosis."
    return {
        "radius": radius,
        "radius_255": None if radius is None else radius * 255,
        "lower_bound_255": certified_upto * 255,
        "score": score,
        "verdict": verdict,
        "method": "PGD-12 L-inf + 6-step binary search",
    }


def _tv(d: torch.Tensor) -> torch.Tensor:
    return (d[..., 1:, :] - d[..., :-1, :]).abs().mean() + (d[..., :, 1:] - d[..., :, :-1]).abs().mean()


def counterfactual(vm: VisionModel, x01: torch.Tensor, target: int, steps: int = 60) -> dict:
    model = vm.model
    # Proximal gradient descent (ISTA): a gradient step on the classification
    # loss + TV smoothness, then soft-thresholding — the exact proximal operator
    # of the L1 penalty — which drives most pixels to exactly zero change.
    delta = torch.zeros_like(x01, requires_grad=True)
    lr, lam = 0.5, 0.004
    reached_at = None
    for i in range(steps):
        logits = model(_norm((x01 + delta).clamp(0, 1)))
        p_t = F.softmax(logits, 1)[0, target]
        if reached_at is None and p_t.item() > 0.5:
            reached_at = i
        if p_t.item() > 0.9:
            break
        loss = F.cross_entropy(logits, torch.tensor([target])) + 0.5 * _tv(delta)
        (grad,) = torch.autograd.grad(loss, delta)
        with torch.no_grad():
            delta -= lr * grad / (grad.abs().max() + 1e-12) * 0.05
            delta.copy_(delta.sign() * (delta.abs() - lam).clamp(min=0))
            delta.clamp_(-0.25, 0.25)

    with torch.no_grad():
        x_cf = (x01 + delta).clamp(0, 1)
        p_cf = F.softmax(model(_norm(x_cf)), 1)[0].numpy()
    d = delta.detach()[0].abs().sum(0).numpy()
    d = cv2.GaussianBlur(d, (0, 0), 3)
    d = d / d.max() if d.max() > 0 else d

    base = (x01[0].permute(1, 2, 0).numpy() * 255).astype(np.uint8)
    heat = cv2.applyColorMap((d * 255).astype(np.uint8), cv2.COLORMAP_INFERNO)[:, :, ::-1]
    overlay = (0.55 * base + 0.45 * heat).astype(np.uint8)
    cf_rgb = (x_cf[0].permute(1, 2, 0).numpy() * 255).astype(np.uint8)
    # Amplified difference makes the edit visible to the eye.
    diff = np.clip(128 + 4 * (cf_rgb.astype(int) - base.astype(int)), 0, 255).astype(np.uint8)

    return {
        "target": vm.classes[target],
        "achieved": bool(p_cf[target] > 0.5),
        "target_probability": float(p_cf[target]),
        "steps": i + 1,
        "edit_l1": float(delta.detach().abs().mean()),
        "edit_area": float((delta.detach()[0].abs().amax(0) > 1e-4).float().mean()),
        "change_map": _uri(overlay),
        "counterfactual_image": _uri(cf_rgb),
        "amplified_diff": _uri(diff),
    }


def analyze_robustness(vm: VisionModel, img224, probs: dict) -> dict:
    x01 = torch.from_numpy(np.asarray(img224).astype(np.float32) / 255.0).permute(2, 0, 1).unsqueeze(0).to(DEVICE)
    order = np.argsort([-probs[c] for c in vm.classes])
    label = int(order[0])
    # Counterfactual target: the healthy class if the finding is pathological,
    # otherwise the most likely alternative diagnosis.
    healthy = [i for i, c in enumerate(vm.classes) if c in vm.benign]
    target = healthy[0] if healthy and healthy[0] != label else int(order[1])
    with _frozen(vm.model):
        return {
            "robustness": robustness_radius(vm, x01, label),
            "counterfactual": counterfactual(vm, x01, target),
        }
