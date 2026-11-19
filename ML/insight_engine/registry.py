"""Loads every Jivika model once and exposes them through a small registry."""
from __future__ import annotations

import os
from dataclasses import dataclass, field

import torch
import torch.nn as nn
from torchvision import models

ML_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEVICE = torch.device("cpu")


@dataclass
class VisionModel:
    key: str
    title: str
    classes: list[str]
    model: nn.Module
    target_layer: nn.Module
    has_dropout: bool = False
    # Classes that are "no finding" for triage purposes.
    benign: set[str] = field(default_factory=set)
    # Severity weight per class, 0 (benign) .. 1 (urgent), used for triage.
    severity: dict[str, float] = field(default_factory=dict)


def _resnet18(num_classes: int, weights_file: str, dropout: float | None = None) -> nn.Module:
    m = models.resnet18(weights=None)
    if dropout is None:
        m.fc = nn.Linear(m.fc.in_features, num_classes)
    else:
        m.fc = nn.Sequential(nn.Dropout(dropout), nn.Linear(m.fc.in_features, num_classes))
    state = torch.load(os.path.join(ML_DIR, weights_file), map_location=DEVICE)
    m.load_state_dict(state)
    return m.to(DEVICE).eval()


def _build() -> dict[str, VisionModel]:
    reg: dict[str, VisionModel] = {}

    router = _resnet18(3, "resnet18_brain_tumor.pth")
    reg["router"] = VisionModel(
        key="router", title="Modality router",
        classes=["wound", "brain", "lung"], model=router, target_layer=router.layer4[-1],
    )

    brain = _resnet18(4, "Brain_Xray_Classification.pth")
    reg["brain"] = VisionModel(
        key="brain", title="Brain MRI — tumour classifier",
        classes=["glioma", "meningioma", "no_tumor", "pituitary"],
        model=brain, target_layer=brain.layer4[-1],
        benign={"no_tumor"},
        severity={"glioma": 1.0, "meningioma": 0.7, "pituitary": 0.6, "no_tumor": 0.0},
    )

    lung = _resnet18(3, "lung_xray_classify.pth")
    reg["lung"] = VisionModel(
        key="lung", title="Chest X-ray — lung classifier",
        classes=["COVID", "HEALTHY", "PNEUMONIA"],
        model=lung, target_layer=lung.layer4[-1],
        benign={"HEALTHY"},
        severity={"COVID": 0.9, "PNEUMONIA": 0.8, "HEALTHY": 0.0},
    )

    wound = _resnet18(7, "woundd.pth", dropout=0.300665)
    reg["wound"] = VisionModel(
        key="wound", title="Wound type classifier",
        classes=["Abrasions", "Bruises", "Burns", "Cut", "Ingrown_nails", "Laceration", "Stab_wound"],
        model=wound, target_layer=wound.layer4[-1], has_dropout=True,
        severity={"Abrasions": 0.2, "Bruises": 0.2, "Burns": 0.7, "Cut": 0.4,
                  "Ingrown_nails": 0.2, "Laceration": 0.6, "Stab_wound": 1.0},
    )
    return reg


VISION: dict[str, VisionModel] = _build()
