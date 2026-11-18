"""FastAPI server for the Jivika Insight Engine.

Run:  ML/.venv/bin/uvicorn insight_engine.server:app --app-dir ML --port 8100
"""
from __future__ import annotations

import asyncio
import multiprocessing as mp
import time
from concurrent.futures import ProcessPoolExecutor

import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import heart, vision
from .registry import VISION
from .robustness import analyze_robustness

torch.set_num_threads(max(1, torch.get_num_threads()))


# heart.analyze runs in a spawned, torch-free process: XGBoost and PyTorch ship
# clashing OpenMP runtimes that deadlock when loaded together on macOS.

_heart_pool = ProcessPoolExecutor(max_workers=1, mp_context=mp.get_context("spawn"))

app = FastAPI(title="Jivika Insight Engine", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"status": "ok", "models": {k: v.title for k, v in VISION.items()}}


@app.post("/v2/analyze")
async def analyze_image(file: UploadFile = File(...), modality: str | None = Form(None),
                        deep: bool = Form(True)):
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    t0 = time.perf_counter()
    try:
        result = vision.analyze(data, modality)
    except Exception as e:  # unreadable image etc.
        raise HTTPException(400, f"Could not analyse image: {e}")
    if deep and result["ood"]["status"] != "out_of_distribution":
        vm = VISION[result["modality"]["selected"]]
        img224 = vision._to_display(vision.load_image(data))
        result.update(analyze_robustness(vm, img224, result["prediction"]["probabilities"]))
        # Fold robustness into the trust score.
        t = result["trust"]
        t["components"]["robustness"] = result["robustness"]["score"]
        t["weights"] = {k: w * 0.85 for k, w in t["weights"].items()} | {"robustness": 0.15}
        t["score"] = sum(t["components"][k] * w for k, w in t["weights"].items())
        result["triage"] = vision.triage(vm, result["prediction"], t, result["ood"])
    result["latency_ms"] = round((time.perf_counter() - t0) * 1000)
    return result


class HeartInput(BaseModel):
    MaxHR: float = Field(..., ge=40, le=230)
    ChestPainType: int = Field(..., ge=0, le=3)
    Cholesterol: float = Field(..., ge=0, le=700)
    Oldpeak: float = Field(..., ge=-3, le=7)
    ST_Slope: int = Field(..., ge=0, le=2)


@app.post("/v2/heart/explain")
async def heart_explain(body: HeartInput):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_heart_pool, heart.analyze, body.model_dump())
