"""Builds Notebooks/jivika_image_models_colab.ipynb from image_models_colab.py."""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
source = (HERE / "image_models_colab.py").read_text()

cells = []
for block in re.split(r"^# %%", source, flags=re.M)[1:]:
    header, _, body = block.partition("\n")
    body = body.strip("\n")
    if "[markdown]" in header:
        text = "\n".join(line[2:] if line.startswith("# ") else line.lstrip("#") for line in body.splitlines())
        cells.append({"cell_type": "markdown", "metadata": {}, "source": text})
    else:
        cells.append({"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": body})

notebook = {
    "cells": cells,
    "metadata": {
        "accelerator": "GPU",
        "colab": {"provenance": [], "gpuType": "T4"},
        "kernelspec": {"display_name": "Python 3", "name": "python3"},
        "language_info": {"name": "python"},
    },
    "nbformat": 4,
    "nbformat_minor": 5,
}
target = HERE.parent / "Notebooks" / "jivika_image_models_colab.ipynb"
target.write_text(json.dumps(notebook, indent=1))
print(f"Wrote {target} ({len(cells)} cells)")
