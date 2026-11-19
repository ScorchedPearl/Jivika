"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, AlertTriangle, Brain, Crosshair, Eye, Fingerprint, Layers, Loader2,
  ScanSearch, ShieldCheck, Sparkles, Upload, Wand2,
} from "lucide-react";
import { Bar, Card, LineChart, Pill, Ring, pct } from "./viz";

const ENGINE = process.env.NEXT_PUBLIC_INSIGHT_ENGINE_URL || "http://localhost:8100";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Result = any;

const VIEWS: { key: string; label: string; group: "xai" | "cf" }[] = [
  { key: "original", label: "Original", group: "xai" },
  { key: "consensus", label: "Consensus", group: "xai" },
  { key: "gradcam", label: "Grad-CAM", group: "xai" },
  { key: "gradcam_pp", label: "Grad-CAM++", group: "xai" },
  { key: "layercam", label: "LayerCAM", group: "xai" },
  { key: "occlusion", label: "Occlusion", group: "xai" },
  { key: "change_map", label: "What must change", group: "cf" },
  { key: "counterfactual_image", label: "Counterfactual scan", group: "cf" },
  { key: "amplified_diff", label: "Edit ×4", group: "cf" },
];

const TRIAGE: Record<string, { tone: string; title: string }> = {
  abstain: { tone: "from-zinc-500 to-zinc-700", title: "AI abstains" },
  review: { tone: "from-amber-500 to-orange-600", title: "Human review needed" },
  urgent: { tone: "from-red-500 to-rose-700", title: "Urgent attention" },
  attention: { tone: "from-yellow-500 to-amber-600", title: "Needs attention" },
  routine: { tone: "from-emerald-500 to-teal-600", title: "Routine" },
};

const COMPONENT_LABEL: Record<string, string> = {
  confidence: "Confidence", stability: "TTA stability", low_epistemic: "Low epistemic unc.",
  familiarity: "In-distribution", explainer_agreement: "Explainer agreement",
  faithfulness: "Faithfulness", robustness: "Adversarial robustness",
};

export default function ImagingLab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [modality, setModality] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [view, setView] = useState("consensus");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setRes(null);
    setError(null);
  };

  const run = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (modality !== "auto") fd.append("modality", modality);
      const r = await fetch(`${ENGINE}/v2/analyze`, { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Analysis failed");
      setRes(j);
      setView("consensus");
    } catch (e: any) {
      setError(e.message === "Failed to fetch" ? `Insight Engine not reachable at ${ENGINE}` : e.message);
    } finally {
      setLoading(false);
    }
  }, [file, modality]);

  const imgFor = (k: string) => {
    if (!res) return preview;
    if (k === "original") return res.explanation.original;
    if (res.explanation.overlays[k]) return res.explanation.overlays[k];
    return res.counterfactual?.[k] ?? res.explanation.original;
  };

  const p = res?.prediction;
  const triage = res ? TRIAGE[res.triage.level] : null;

  return (
    <div className="space-y-6">
      {/* Upload */}
      <Card>
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed p-4 transition-colors ${drag ? "border-[var(--brand-line)] bg-brand-tint" : "border-border hover:border-[var(--brand-line)]"}`}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="upload preview" className="h-16 w-16 rounded-lg object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-surface-2"><Upload className="text-muted-foreground" /></div>
            )}
            <div>
              <p className="font-medium text-foreground">{file ? file.name : "Drop a brain MRI, chest X-ray or wound photo"}</p>
              <p className="text-xs text-muted-foreground">Auto-routed to the right specialist model · JPG / PNG</p>
            </div>
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={modality}
              onChange={(e) => setModality(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              aria-label="Modality"
            >
              <option value="auto">Auto-detect modality</option>
              <option value="brain">Brain MRI</option>
              <option value="lung">Chest X-ray</option>
              <option value="wound">Wound</option>
            </select>
            <button
              onClick={run}
              disabled={!file || loading}
              className="flex items-center gap-2 rounded-full bg-brand-gradient px-5 py-2 font-medium text-on-brand transition hover:brightness-110 disabled:opacity-40"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              {loading ? "Analysing…" : "Run deep analysis"}
            </button>
          </div>
        </div>
        {loading && (
          <p className="mt-3 text-xs text-muted-foreground">
            Running TTA ensemble · 4 explainers · deletion test · PGD robustness search · counterfactual optimisation…
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </Card>

      <AnimatePresence>
        {res && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Triage banner */}
            <div className={`flex flex-col gap-2 rounded-2xl bg-gradient-to-r ${triage!.tone} p-5 text-white md:flex-row md:items-center md:justify-between`}>
              <div>
                <p className="text-xs uppercase tracking-widest opacity-80">{res.model} · {res.latency_ms} ms</p>
                <h2 className="text-2xl font-bold">
                  {triage!.title}: {p.prediction.replaceAll("_", " ")} <span className="font-normal opacity-80">({pct(p.confidence)})</span>
                </h2>
                <p className="text-sm opacity-90">{res.triage.action}</p>
              </div>
              <div className="text-right text-sm opacity-90">
                <p>Modality: <b>{res.modality.selected}</b>{res.modality.overridden && " (manual)"}</p>
                <p>Expected severity: <b>{pct(res.triage.expected_severity)}</b></p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
              {/* Visual explanations */}
              <Card title="Explainability studio" subtitle="Where the model looks — and what would change its mind" icon={<Eye size={18} />}>
                <div className="relative overflow-hidden rounded-xl bg-black">
                  <AnimatePresence mode="wait">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <motion.img
                      key={view}
                      src={imgFor(view) || ""}
                      alt={view}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="mx-auto aspect-square w-full max-w-[460px] object-contain [image-rendering:auto]"
                    />
                  </AnimatePresence>
                </div>
                <p className="mt-4 mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Saliency explainers</p>
                <div className="flex flex-wrap gap-2">
                  {VIEWS.filter((v) => v.group === "xai").map((v) => (
                    <button key={v.key} onClick={() => setView(v.key)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${view === v.key ? "bg-brand-gradient text-on-brand" : "bg-surface-2 text-muted-foreground hover:text-foreground"}`}>
                      {v.label}
                    </button>
                  ))}
                </div>
                {res.counterfactual && (
                  <>
                    <p className="mt-4 mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Counterfactual → “{res.counterfactual.target.replaceAll("_", " ")}”
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {VIEWS.filter((v) => v.group === "cf").map((v) => (
                        <button key={v.key} onClick={() => setView(v.key)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${view === v.key ? "bg-fuchsia-600 text-white" : "bg-surface-2 text-muted-foreground hover:text-foreground"}`}>
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <Stat label="Explainer agreement" value={pct(res.explanation.explainer_agreement)} hint="mean IoU of top-15% regions" />
                  <Stat label="Faithfulness" value={res.explanation.deletion.faithfulness.toFixed(2)} hint="deletion AUC vs random" />
                  <Stat label="Focus area" value={pct(res.explanation.focus_area)} hint="of image above median saliency" />
                </div>
              </Card>

              <div className="space-y-6">
                {/* Trust */}
                <Card title="Trust score" subtitle="Fuses 7 independent reliability signals" icon={<ShieldCheck size={18} />}>
                  <div className="flex flex-col items-center gap-5 sm:flex-row">
                    <Ring value={res.trust.score} label="trust"
                      color={res.trust.score > 0.7 ? "#10b981" : res.trust.score > 0.5 ? "#f59e0b" : "#ef4444"} />
                    <div className="w-full space-y-2">
                      {Object.entries(res.trust.components).map(([k, v]: any) => (
                        <Bar key={k} label={COMPONENT_LABEL[k] ?? k} value={v}
                          right={`${pct(v)} · w ${(res.trust.weights[k] * 100).toFixed(0)}`} />
                      ))}
                    </div>
                  </div>
                </Card>

                {/* Prediction distribution */}
                <Card title="Predictive distribution" subtitle={`Bayesian ensemble over ${p.samples} stochastic passes (${p.uncertainty.method})`} icon={<Activity size={18} />}>
                  <div className="space-y-2.5">
                    {Object.entries(p.probabilities)
                      .sort((a: any, b: any) => b[1] - a[1])
                      .map(([c, v]: any) => (
                        <Bar key={c} label={c.replaceAll("_", " ")} value={v} err={p.probability_std[c]} highlight={c === p.prediction} />
                      ))}
                  </div>
                  <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">Uncertainty decomposition (normalised entropy)</p>
                  <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-surface-2">
                    <motion.div className="bg-sky-500" initial={{ width: 0 }} animate={{ width: pct(p.uncertainty.aleatoric, 1) }} transition={{ duration: 0.8 }} />
                    <motion.div className="bg-fuchsia-500" initial={{ width: 0 }} animate={{ width: pct(p.uncertainty.epistemic, 1) }} transition={{ duration: 0.8 }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-500" />Aleatoric (data noise) {pct(p.uncertainty.aleatoric, 1)}</span>
                    <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-fuchsia-500" />Epistemic (model doesn’t know) {pct(p.uncertainty.epistemic, 1)}</span>
                    <span>Augmentation agreement {pct(p.agreement)}</span>
                  </div>
                </Card>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <Card title="Out-of-distribution guard" subtitle={res.ood.method} icon={<ScanSearch size={18} />}>
                <div className="mb-3">
                  <Pill tone={res.ood.status === "in_distribution" ? "good" : res.ood.status === "out_of_distribution" ? "bad" : "warn"}>
                    {res.ood.status.replaceAll("_", " ")}
                  </Pill>
                </div>
                <p className="text-sm text-muted-foreground">{res.ood.message}</p>
                <div className="mt-4"><Bar label="Familiarity" value={res.ood.familiarity} /></div>
                <p className="mt-2 text-xs text-muted-foreground">Energy score {res.ood.energy.toFixed(2)}</p>
              </Card>

              {res.robustness ? (
                <Card title="Adversarial robustness" subtitle={res.robustness.method} icon={<Crosshair size={18} />}>
                  <div className="flex items-center gap-4">
                    <Ring value={res.robustness.score} label="robust" size={104}
                      color={res.robustness.score > 0.5 ? "#10b981" : res.robustness.score > 0.15 ? "#f59e0b" : "#ef4444"} />
                    <div className="text-sm">
                      <p className="text-foreground">
                        Flip radius:{" "}
                        <b>{res.robustness.radius_255 === null ? "> 16/255" : `${res.robustness.radius_255.toFixed(2)}/255`}</b>
                      </p>
                      <p className="mt-1 text-muted-foreground">{res.robustness.verdict}</p>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card title="Adversarial robustness" icon={<Crosshair size={18} />}>
                  <p className="text-sm text-muted-foreground">Skipped — image rejected as out-of-distribution.</p>
                </Card>
              )}

              {res.counterfactual && (
                <Card title="Counterfactual explanation" subtitle="Sparse ISTA-optimised edit that changes the diagnosis" icon={<Wand2 size={18} />}>
                  <p className="text-sm text-foreground">
                    Editing <b>{pct(res.counterfactual.edit_area, 1)}</b> of pixels flips the model to{" "}
                    <b>{res.counterfactual.target.replaceAll("_", " ")}</b> ({pct(res.counterfactual.target_probability)}) in {res.counterfactual.steps} steps.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Unlike heatmaps, this edit is causal for the model: it is the change that actually produces the alternative diagnosis.
                    View it with “What must change”.
                  </p>
                </Card>
              )}

              <Card title="Deletion test (faithfulness)" subtitle="Remove most-salient pixels first — confidence should collapse faster than random" icon={<Layers size={18} />} className="md:col-span-2 xl:col-span-2">
                <LineChart
                  x={res.explanation.deletion.fractions}
                  xLabel="fraction of pixels deleted"
                  series={[
                    { name: "Salient-first", y: res.explanation.deletion.salient, color: "var(--brand-ink)" },
                    { name: "Random", y: res.explanation.deletion.random, color: "#a1a1aa", dashed: true },
                  ]}
                />
              </Card>

              <Card title="Modality router" subtitle="First-stage classifier choosing the specialist" icon={<Brain size={18} />}>
                <div className="space-y-2">
                  {Object.entries(res.modality.probabilities).map(([k, v]: any) => (
                    <Bar key={k} label={k} value={v} highlight={k === res.modality.selected} />
                  ))}
                </div>
              </Card>
            </div>

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Research prototype for decision support only — not a medical device. Always confirm with a qualified clinician.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!res && !loading && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { i: <Fingerprint />, t: "Uncertainty you can read", d: "Test-time augmentation + MC-dropout split uncertainty into aleatoric and epistemic parts (BALD)." },
            { i: <Crosshair />, t: "Robustness certificate", d: "PGD binary search finds the smallest perturbation that flips the diagnosis." },
            { i: <Wand2 />, t: "Counterfactual scans", d: "Sparse optimisation shows exactly what would have to change for a healthy result." },
          ].map((f) => (
            <Card key={f.t}>
              <div className="mb-2 text-brand">{f.i}</div>
              <h4 className="font-semibold text-foreground">{f.t}</h4>
              <p className="text-sm text-muted-foreground">{f.d}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl bg-surface p-3" title={hint}>
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
