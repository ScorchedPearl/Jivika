# Source of Notebooks/jivika_image_models_colab.ipynb. Edit here, then run
#   python training/make_notebook.py
# Cells are split on the "# %%" lines.

# %% [markdown]
# # Jivika image models: measure, calibrate, and teach them to say "not mine"
#
# This notebook does three things for the brain MRI, chest X-ray and wound models:
#
# 1. **Measures** each model on images held back for testing, and fits a **temperature** so that a confidence of 80% is right about 80% of the time.
# 2. **Retrains the image router** with a fourth class, `other`, so photos and unrelated scans are turned away instead of being forced into one of three boxes.
# 3. Fits an **out-of-distribution detector** for each model, which flags images that don't look like anything the model was trained on.
#
# **How to run it**
#
# 1. Runtime → Change runtime type → **T4 GPU**.
# 2. Runtime → Run all. When asked, upload the four `.pth` files from the project's `ML/` folder.
# 3. At the end a file called `jivika_artifacts.zip` downloads. Unzip it into `ML/` and rebuild the `ml` container. The service picks the new files up by itself.
#
# It takes roughly 30 to 45 minutes on a T4.

# %% [colab]
!pip -q install kagglehub medmnist

# %% [lib]
import json
import random
import re
import zipfile
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
from PIL import Image, ImageOps
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms
from torchvision.transforms import functional as TF

SEED = 2706
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
WORK = Path("/content/jivika")
OUT = WORK / "artifacts"
print("Running on", device)

# The models exactly as ML/service.py loads them
SPECIALISTS = {
    "brain": {
        "weights": "Brain_Xray_Classification.pth",
        "classes": ["glioma", "meningioma", "no_tumor", "pituitary"],
        "dropout_head": False,
        "dataset": "indk214/brain-tumor-dataset-segmentation-and-classification",
    },
    "lung": {
        "weights": "lung_xray_classify.pth",
        "classes": ["COVID", "HEALTHY", "PNEUMONIA"],
        "dropout_head": False,
        "dataset": "sachinkumar413/covid-pneumonia-normal-chest-xray-images",
    },
    "wound": {
        "weights": "woundd.pth",
        "classes": ["Abrasions", "Bruises", "Burns", "Cut", "Ingrown_nails", "Laceration", "Stab_wound"],
        "dropout_head": True,
        "dataset": "yasinpratomo/wound-dataset",
    },
}
ROUTER_CLASSES = ["wound", "brain", "lung", "other"]

# Dataset folders don't always use the model's class names
ALIASES = {
    "notumor": {"notumor", "no", "normal", "healthy"},
    "healthy": {"healthy", "normal"},
    "laceration": {"laceration", "laseration", "lacerations"},
    "ingrownnails": {"ingrownnails", "ingrownnail"},
    "stabwound": {"stabwound", "stabwounds"},
    "abrasions": {"abrasions", "abrasion"},
    "bruises": {"bruises", "bruise"},
    "burns": {"burns", "burn"},
    "cut": {"cut", "cuts"},
    "glioma": {"glioma", "gliomatumor"},
    "meningioma": {"meningioma", "meningiomatumor"},
    "pituitary": {"pituitary", "pituitarytumor"},
    "covid": {"covid", "covid19"},
    "pneumonia": {"pneumonia"},
}
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".bmp", ".webp"}


def plain(name):
    return re.sub("[^a-z0-9]", "", name.lower())


def folder_for(class_name, folders):
    wanted = ALIASES.get(plain(class_name), {plain(class_name)})
    return next((f for f in folders if plain(f.name) in wanted), None)


def find_class_roots(root, classes):
    """Every folder under root that holds one sub-folder per class."""
    roots = []
    for folder in [Path(root), *sorted(p for p in Path(root).rglob("*") if p.is_dir())]:
        children = [c for c in folder.iterdir() if c.is_dir()]
        if all(folder_for(c, children) for c in classes):
            roots.append(folder)
    return roots


def list_images(class_root, classes):
    """[(path, class index)] for one folder of class sub-folders."""
    children = [c for c in class_root.iterdir() if c.is_dir()]
    items = []
    for index, class_name in enumerate(classes):
        folder = folder_for(class_name, children)
        items += [(p, index) for p in sorted(folder.rglob("*")) if p.suffix.lower() in IMAGE_SUFFIXES]
    return items


def split_three(items, fractions=(0.7, 0.15, 0.15)):
    items = list(items)
    random.Random(SEED).shuffle(items)
    a = int(len(items) * fractions[0])
    b = a + int(len(items) * fractions[1])
    return items[:a], items[a:b], items[b:]


def make_splits(dataset_root, classes):
    """train / val / test lists. Uses the dataset's own test folder when it has one."""
    roots = find_class_roots(dataset_root, classes)
    if not roots:
        raise RuntimeError(f"No folder under {dataset_root} has all of: {classes}")
    test_roots = [r for r in roots if "test" in r.name.lower()]
    if test_roots:
        rest = [i for r in roots if r not in test_roots for i in list_images(r, classes)]
        train, val, extra = split_three(rest, (0.85, 0.15, 0.0))
        test = [i for r in test_roots for i in list_images(r, classes)]
        return {"train": train + extra, "val": val, "test": test, "own_test_folder": True}
    train, val, test = split_three(list_images(roots[0], classes))
    return {"train": train, "val": val, "test": test, "own_test_folder": False}


# ---- The same image handling as ML/service.py ----

normalize = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def open_image(path):
    return ImageOps.exif_transpose(Image.open(path)).convert("RGB")


def standard_view(image):
    return TF.center_crop(TF.resize(image, 256), 224)


def test_views(image):
    base = standard_view(image)
    return [base, TF.hflip(base), TF.center_crop(TF.resize(image, 288), 224)]


class Views(Dataset):
    """Each image as the three views the service averages over."""

    def __init__(self, items):
        self.items = items

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        path, label = self.items[i]
        return torch.stack([normalize(v) for v in test_views(open_image(path))]), label


def build_model(n_classes, dropout_head=False, weights_path=None, pretrained=False):
    model = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1 if pretrained else None)
    head = nn.Linear(model.fc.in_features, n_classes)
    model.fc = nn.Sequential(nn.Dropout(0.300665), head) if dropout_head else head
    if weights_path:
        model.load_state_dict(torch.load(weights_path, map_location=device))
    return model.to(device).eval()


@torch.no_grad()
def run_model(model, items, batch_size=32, workers=2):
    """Logits for every view, the 512 features of the standard view, and the labels."""
    body = nn.Sequential(*list(model.children())[:-1])
    logits, features, labels = [], [], []
    for views, y in DataLoader(Views(items), batch_size=batch_size, num_workers=workers):
        n, v = views.shape[:2]
        pooled = torch.flatten(body(views.flatten(0, 1).to(device)), 1)
        logits.append(model.fc(pooled).view(n, v, -1).cpu())
        features.append(pooled.view(n, v, -1)[:, 0].cpu())
        labels.append(y)
    return torch.cat(logits).numpy(), torch.cat(features).numpy(), torch.cat(labels).numpy()


def probabilities(logits, temperature=1.0):
    """Softmax of each view at the given temperature, averaged, as the service does."""
    scaled = logits / temperature
    scaled = scaled - scaled.max(axis=2, keepdims=True)
    soft = np.exp(scaled)
    soft /= soft.sum(axis=2, keepdims=True)
    return soft.mean(axis=1)


def calibration_error(probs, labels, bins=15):
    """Expected calibration error: the average gap between confidence and accuracy."""
    confidence, predicted = probs.max(axis=1), probs.argmax(axis=1)
    error = 0.0
    for low in np.linspace(0, 1, bins, endpoint=False):
        inside = (confidence > low) & (confidence <= low + 1 / bins)
        if inside.any():
            error += inside.mean() * abs((predicted[inside] == labels[inside]).mean() - confidence[inside].mean())
    return float(error)


def fit_temperature(logits, labels):
    """The temperature that makes the held-out images most likely."""
    def loss(t):
        p = probabilities(logits, t)
        return -np.log(p[np.arange(len(labels)), labels] + 1e-12).mean()

    grid = np.exp(np.linspace(np.log(0.5), np.log(8), 80))
    return float(grid[int(np.argmin([loss(t) for t in grid]))])


def summarise(probs, labels, classes):
    predicted = probs.argmax(axis=1)
    confident = probs.max(axis=1) >= 0.55  # the service's MIN_CONFIDENCE
    per_class = classification_report(labels, predicted, labels=list(range(len(classes))), target_names=classes, output_dict=True, zero_division=0)
    return {
        "images": int(len(labels)),
        "accuracy": round(float((predicted == labels).mean()), 4),
        "calibration_error": round(calibration_error(probs, labels), 4),
        "answered_confidently": round(float(confident.mean()), 4),
        "accuracy_when_confident": round(float((predicted[confident] == labels[confident]).mean()), 4) if confident.any() else None,
        "per_class": {c: {k: round(per_class[c][k], 4) for k in ("precision", "recall", "f1-score")} for c in classes},
        "confusion_matrix": confusion_matrix(labels, predicted, labels=list(range(len(classes)))).tolist(),
    }


def show_confusion(matrix, classes, title):
    matrix = np.array(matrix)
    fig, ax = plt.subplots(figsize=(1.1 * len(classes) + 2, 1.1 * len(classes) + 1.5))
    ax.imshow(matrix, cmap="Blues")
    ax.set_xticks(range(len(classes)), classes, rotation=45, ha="right")
    ax.set_yticks(range(len(classes)), classes)
    for (r, c), n in np.ndenumerate(matrix):
        ax.text(c, r, n, ha="center", va="center", color="white" if n > matrix.max() / 2 else "black")
    ax.set_xlabel("Model said")
    ax.set_ylabel("Truth")
    ax.set_title(title)
    plt.tight_layout()
    plt.show()


# ---- Out-of-distribution detector ----

def fit_detector(features, labels, n_classes):
    """Mahalanobis distance: how far an image's features sit from every class the model knows."""
    means = np.stack([features[labels == c].mean(axis=0) for c in range(n_classes)])
    centred = features - means[labels]
    covariance = centred.T @ centred / len(features)
    covariance += np.eye(covariance.shape[0]) * 1e-3 * np.trace(covariance) / covariance.shape[0]
    return means.astype(np.float32), np.linalg.inv(covariance).astype(np.float32)


def distance(features, means, precision):
    diff = features[:, None, :] - means[None, :, :]
    return np.einsum("ncd,de,nce->nc", diff, precision, diff).min(axis=1)


# ---- Router training ----

class Degrade:
    """Sometimes shrinks an image and blows it back up, so sharpness can't be used as a shortcut."""

    def __call__(self, image):
        if random.random() < 0.3:
            side = random.randint(64, 128)
            image = image.resize((side, side)).resize(image.size)
        return image


router_training_view = transforms.Compose([
    transforms.RandomResizedCrop(224, scale=(0.6, 1.0)),
    transforms.RandomHorizontalFlip(),
    # A third of colour images are shown in grey, so "grey means scan" stops working
    transforms.RandomGrayscale(p=0.33),
    transforms.ColorJitter(0.2, 0.2, 0.2),
    Degrade(),
    normalize,
])


class Training(Dataset):
    def __init__(self, items):
        self.items = items

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        path, label = self.items[i]
        return router_training_view(open_image(path)), label


def train_router(train_items, val_items, epochs=5, batch_size=64, workers=2, pretrained=True):
    model = build_model(len(ROUTER_CLASSES), pretrained=pretrained)
    optimiser = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=0.01)
    loader = DataLoader(Training(train_items), batch_size=batch_size, shuffle=True, num_workers=workers, drop_last=True)
    schedule = torch.optim.lr_scheduler.OneCycleLR(optimiser, max_lr=3e-4, total_steps=epochs * len(loader))
    loss_fn = nn.CrossEntropyLoss(label_smoothing=0.05)

    best, best_state = -1, None
    for epoch in range(epochs):
        model.train()
        for images, labels in loader:
            optimiser.zero_grad()
            loss = loss_fn(model(images.to(device)), labels.to(device))
            loss.backward()
            optimiser.step()
            schedule.step()
        model.eval()
        logits, _, labels = run_model(model, val_items, workers=workers)
        accuracy = float((probabilities(logits).argmax(axis=1) == labels).mean())
        print(f"epoch {epoch + 1}/{epochs}: last loss {loss.item():.3f}, validation accuracy {accuracy:.1%}")
        if accuracy > best:
            best, best_state = accuracy, {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
    model.load_state_dict(best_state)
    return model.eval()


def cap(items, limit):
    items = list(items)
    random.Random(SEED).shuffle(items)
    return items[:limit]

# %% [markdown]
# ## 1. Upload the model weights
# Pick these four files from the project's `ML/` folder: `Brain_Xray_Classification.pth`, `lung_xray_classify.pth`, `woundd.pth`, `resnet18_brain_tumor.pth`.

# %% [colab]
from google.colab import files

WORK.mkdir(parents=True, exist_ok=True)
OUT.mkdir(exist_ok=True)
needed = [spec["weights"] for spec in SPECIALISTS.values()] + ["resnet18_brain_tumor.pth"]
while missing := [name for name in needed if not (WORK / name).exists()]:
    print("Please upload:", ", ".join(missing))
    for name, content in files.upload().items():
        (WORK / name).write_bytes(content)

# %% [markdown]
# ## 2. Download the datasets
# These are the public Kaggle datasets the models were first trained on. If one fails to download, open it on kaggle.com, copy the `owner/name` part of its address into `SPECIALISTS` above, and run this cell again.

# %% [colab]
import kagglehub

splits = {}
for kind, spec in SPECIALISTS.items():
    root = kagglehub.dataset_download(spec["dataset"])
    splits[kind] = make_splits(root, spec["classes"])
    print(kind, {name: len(items) for name, items in splits[kind].items() if name != "own_test_folder"},
          "(dataset's own test folder)" if splits[kind]["own_test_folder"] else "(split made here)")

# %% [markdown]
# ## 3. Measure and calibrate each model
# The **test** images give the scores. The **validation** images are used to fit the temperature.
#
# One caution. Where the split was made here (not the dataset's own test folder), the current weights may have seen some of these test images during their original training, so their accuracy can look better than it really is. The calibration and the detector are still valid to use.

# %% [run]
report = {"models": {}}
temperatures = {}
cache = {}

for kind, spec in SPECIALISTS.items():
    model = build_model(len(spec["classes"]), spec["dropout_head"], WORK / spec["weights"])
    cache[kind] = {part: run_model(model, splits[kind][part] if part != "train" else cap(splits[kind]["train"], 3000)) for part in ("train", "val", "test")}

    val_logits, _, val_labels = cache[kind]["val"]
    test_logits, _, test_labels = cache[kind]["test"]
    temperatures[kind] = fit_temperature(val_logits, val_labels)

    before = summarise(probabilities(test_logits), test_labels, spec["classes"])
    after = summarise(probabilities(test_logits, temperatures[kind]), test_labels, spec["classes"])
    report["models"][kind] = {
        "temperature": round(temperatures[kind], 3),
        "test_may_overlap_training": not splits[kind]["own_test_folder"],
        "before_calibration": before,
        "after_calibration": after,
    }

    print(f"\n===== {kind} =====")
    print(f"Accuracy on {after['images']} test images: {after['accuracy']:.1%}")
    print(f"Calibration error: {before['calibration_error']:.3f} before, {after['calibration_error']:.3f} after (temperature {temperatures[kind]:.2f})")
    if after["accuracy_when_confident"] is not None:
        print(f"Answers given confidently: {after['answered_confidently']:.1%}, and of those {after['accuracy_when_confident']:.1%} are right")
    for name, scores in after["per_class"].items():
        print(f"  {name:<16} precision {scores['precision']:.1%}  recall {scores['recall']:.1%}")
    show_confusion(after["confusion_matrix"], spec["classes"], f"{kind}: test images")

(OUT / "calibration.json").write_text(json.dumps({k: round(t, 4) for k, t in temperatures.items()}, indent=2))

# %% [markdown]
# ## 4. Collect "other" images
# Ordinary photos (Imagenette) and four kinds of medical image the app can't read: abdominal CT, skin lesions, retina photos and breast ultrasound (MedMNIST). A source that fails to download is skipped.

# %% [colab]
import medmnist
from torchvision.datasets import Imagenette

other_root = WORK / "other"
other_items = []

try:
    Imagenette(str(other_root / "photos"), split="train", size="160px", download=not (other_root / "photos").exists())
    photos = sorted((other_root / "photos").rglob("*.JPEG"))
    other_items += [(p, 3) for p in cap(photos, 4000)]
    print("Photos:", len(photos))
except Exception as e:
    print("Skipped photos:", e)

for name in ("organamnist", "dermamnist", "retinamnist", "breastmnist"):
    try:
        folder = other_root / name
        if not folder.exists():
            folder.mkdir(parents=True)
            data = getattr(medmnist, medmnist.INFO[name]["python_class"])(split="train", download=True, size=128, root=str(other_root))
            for i in cap(range(len(data.imgs)), 1500):
                Image.fromarray(data.imgs[i]).save(folder / f"{i}.png")
        found = sorted(folder.glob("*.png"))
        other_items += [(p, 3) for p in found]
        print(f"{name}: {len(found)}")
    except Exception as e:
        print(f"Skipped {name}:", e)

other = dict(zip(("train", "val", "test"), split_three(other_items)))

# %% [markdown]
# ## 5. Retrain the router with an "other" class

# %% [run]
router_items = {part: list(other[part]) for part in ("train", "val", "test")}
for index, kind in enumerate(ROUTER_CLASSES[:3]):
    for part, limit in (("train", 3000), ("val", 500), ("test", 500)):
        router_items[part] += [(path, index) for path, _ in cap(splits[kind][part], limit)]

router = train_router(router_items["train"], router_items["val"])
logits, _, labels = run_model(router, router_items["test"])
router_scores = summarise(probabilities(logits), labels, ROUTER_CLASSES)

# The old router, for comparison: it has no "other", so every "other" image counts as a miss
old_router = build_model(3, weights_path=WORK / "resnet18_brain_tumor.pth")
old_logits, _, _ = run_model(old_router, router_items["test"])
old_probs = probabilities(old_logits)
old_predicted = np.where(old_probs.max(axis=1) >= 0.75, old_probs.argmax(axis=1), 3)  # below 0.75 the service turns the image away

report["router"] = {"new": router_scores, "old_accuracy_with_its_threshold": round(float((old_predicted == labels).mean()), 4)}
print(f"\nNew router: {router_scores['accuracy']:.1%} on {router_scores['images']} test images")
print(f"Old router with its 0.75 cut-off: {report['router']['old_accuracy_with_its_threshold']:.1%}")
show_confusion(router_scores["confusion_matrix"], ROUTER_CLASSES, "New router: test images")

torch.save(router.state_dict(), OUT / "router_v2.pth")

# %% [markdown]
# ## 6. Out-of-distribution detectors
# For each model, the detector learns where that model's own training images sit in its feature space. An image far from all of them is flagged. The cut-off is set so that about 2.5% of genuine images are flagged.

# %% [run]
report["detectors"] = {}
for kind, spec in SPECIALISTS.items():
    model = build_model(len(spec["classes"]), spec["dropout_head"], WORK / spec["weights"])
    _, train_features, train_labels = cache[kind]["train"]
    _, val_features, _ = cache[kind]["val"]
    _, test_features, _ = cache[kind]["test"]

    means, precision = fit_detector(train_features, train_labels, len(spec["classes"]))
    threshold = float(np.percentile(distance(val_features, means, precision), 97.5))

    # Things this model should refuse: "other" images, and the other two models' images
    strangers = cap(other["test"], 600)
    for other_kind in SPECIALISTS:
        if other_kind != kind:
            strangers += cap(splits[other_kind]["test"], 300)
    _, stranger_features, _ = run_model(model, strangers)

    genuine = distance(test_features, means, precision)
    strange = distance(stranger_features, means, precision)
    scores = {
        "threshold": round(threshold, 2),
        "auroc": round(float(roc_auc_score(np.r_[np.zeros(len(genuine)), np.ones(len(strange))], np.r_[genuine, strange])), 4),
        "strangers_caught": round(float((strange > threshold).mean()), 4),
        "genuine_wrongly_flagged": round(float((genuine > threshold).mean()), 4),
    }
    report["detectors"][kind] = scores
    print(f"{kind}: catches {scores['strangers_caught']:.1%} of images that aren't its own, "
          f"wrongly flags {scores['genuine_wrongly_flagged']:.1%} of genuine ones (AUROC {scores['auroc']:.3f})")

    np.savez(OUT / f"ood_{kind}.npz", means=means, precision=precision, threshold=np.float32(threshold))

# %% [markdown]
# ## 7. Download the results
# Unzip into the project's `ML/` folder, then run `docker compose up -d --build ml`.

# %% [colab]
(OUT / "eval_report.json").write_text(json.dumps(report, indent=2))
archive = WORK / "jivika_artifacts.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    for path in sorted(OUT.iterdir()):
        z.write(path, path.name)
        print(f"{path.name}: {path.stat().st_size / 1e6:.1f} MB")
files.download(str(archive))
