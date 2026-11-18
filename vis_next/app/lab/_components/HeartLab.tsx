"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GitCompareArrows, HeartPulse, Loader2, Route, Scale, Users } from "lucide-react";
import { Bar, Card, LineChart, Pill, Ring, pct } from "./viz";

const ENGINE = process.env.NEXT_PUBLIC_INSIGHT_ENGINE_URL || "http://localhost:8100";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Features = { MaxHR: number; ChestPainType: number; Cholesterol: number; Oldpeak: number; ST_Slope: number };

const SLIDERS: { key: keyof Features; label: string; min: number; max: number; step: number; unit?: string }[] = [
  { key: "MaxHR", label: "Max heart rate", min: 60, max: 202, step: 1, unit: "bpm" },
  { key: "Cholesterol", label: "Cholesterol", min: 85, max: 603, step: 1, unit: "mg/dl" },
  { key: "Oldpeak", label: "Oldpeak (ST depression)", min: -2.6, max: 6.2, step: 0.1 },
];
const CHEST = ["Asymptomatic", "Atypical angina", "Non-anginal", "Typical angina"];
const SLOPE = ["Down", "Flat", "Up"];

export default function HeartLab() {
  const [f, setF] = useState<Features>({ MaxHR: 120, ChestPainType: 0, Cholesterol: 280, Oldpeak: 2.0, ST_Slope: 1 });
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<keyof Features>("Oldpeak");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const id = ++seq.current;
      setLoading(true);
      try {
        const r = await fetch(`${ENGINE}/v2/heart/explain`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(JSON.stringify(j.detail));
        if (id === seq.current) { setRes(j); setError(null); }
      } catch (e: any) {
        if (id === seq.current) setError(e.message === "Failed to fetch" ? `Insight Engine not reachable at ${ENGINE}` : e.message);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 250);
  }, [f]);

  const applyRecourse = () => {
    if (!res?.recourse?.changes) return;
    const next = { ...f };
    res.recourse.changes.forEach((c: any) => { (next as any)[c.feature] = c.to; });
    setF(next);
  };

  const shap = res ? Object.entries(res.shapley.values as Record<string, number>).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])) : [];
  const maxAbs = Math.max(0.05, ...shap.map(([, v]) => Math.abs(v)));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-6">
        <Card title="Patient profile" subtitle="Move the sliders — the ensemble re-explains itself live" icon={<HeartPulse size={18} />}>
          <div className="space-y-5">
            {SLIDERS.map((s) => (
              <div key={s.key} onMouseEnter={() => setFocus(s.key)}>
                <div className="mb-1 flex justify-between text-sm">
                  <label htmlFor={s.key} className="text-muted-foreground">{s.label}</label>
                  <span className="font-semibold tabular-nums text-foreground">{f[s.key]} {s.unit}</span>
                </div>
                <input id={s.key} type="range" min={s.min} max={s.max} step={s.step} value={f[s.key]}
                  onChange={(e) => setF({ ...f, [s.key]: Number(e.target.value) })}
                  className="w-full accent-[var(--primary)]" />
              </div>
            ))}
            <Segmented label="Chest pain type" options={CHEST} value={f.ChestPainType} onChange={(v) => { setF({ ...f, ChestPainType: v }); setFocus("ChestPainType"); }} />
            <Segmented label="ST slope" options={SLOPE} value={f.ST_Slope} onChange={(v) => { setF({ ...f, ST_Slope: v }); setFocus("ST_Slope"); }} />
          </div>
        </Card>

        {res && (
          <Card title="Counterfactual recourse" subtitle="Smallest actionable change that brings risk below 50%" icon={<Route size={18} />}>
            {!res.recourse.needed ? (
              <p className="text-sm text-muted-foreground">Risk is already below the decision threshold — no change needed.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {res.recourse.changes.map((c: any) => (
                    <li key={c.feature} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{c.feature}</span>
                      <span className="font-medium text-foreground">{c.from} → <span className="text-primary">{c.to}</span></span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-foreground">
                  {res.recourse.found
                    ? <>Predicted risk drops <b>{pct(res.recourse.current_risk)}</b> → <b className="text-emerald-500">{pct(res.recourse.new_risk)}</b></>
                    : <>No change within safe bounds gets below 50%; best reachable: <b>{pct(res.recourse.best_risk)}</b></>}
                </p>
                <button onClick={applyRecourse} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  Apply these changes
                </button>
                <p className="mt-2 text-[11px] text-muted-foreground">Model-based what-if, not medical advice: discuss any change with your doctor.</p>
              </>
            )}
          </Card>
        )}
      </div>

      <div className="space-y-6">
        {error && <Card><p className="text-sm text-red-500">{error}</p></Card>}
        {res && (
          <>
            <Card>
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <div className="relative">
                  <Ring value={res.risk} label="risk" size={150} color={res.risk >= 0.5 ? "#ef4444" : "#10b981"} />
                  {loading && <Loader2 className="absolute -right-2 -top-2 animate-spin text-muted-foreground" size={16} />}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{res.label}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill tone={res.ensemble.consensus ? "good" : "warn"}>
                      {res.ensemble.consensus ? "All 3 models agree" : "Models disagree"}
                    </Pill>
                    <Pill>Ensemble spread ±{pct(res.ensemble.spread, 1)}</Pill>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Soft-voting ensemble of logistic regression, random forest and XGBoost.</p>
                </div>
              </div>
            </Card>

            <Card title="Exact Shapley attribution" subtitle={`All 32 feature coalitions evaluated · baseline = population reference (${pct(res.shapley.base_value)})`} icon={<Scale size={18} />}>
              <div className="space-y-2">
                {shap.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[110px_1fr_64px] items-center gap-2 text-sm">
                    <span className="truncate text-muted-foreground">{k}</span>
                    <div className="relative h-5">
                      <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                      <motion.div
                        className={`absolute top-0.5 h-4 rounded ${v >= 0 ? "bg-red-500/80" : "bg-emerald-500/80"}`}
                        initial={false}
                        animate={{ left: v >= 0 ? "50%" : `${50 - (Math.abs(v) / maxAbs) * 50}%`, width: `${(Math.abs(v) / maxAbs) * 50}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                    <span className={`text-right tabular-nums ${v >= 0 ? "text-red-500" : "text-emerald-500"}`}>{v >= 0 ? "+" : ""}{(v * 100).toFixed(1)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {pct(res.shapley.base_value, 1)} baseline + Σ contributions = {pct(res.shapley.prediction, 1)} predicted risk (efficiency error {res.shapley.efficiency_check.toExponential(1)}).
              </p>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card title="Ensemble members" subtitle="Committee disagreement as uncertainty" icon={<Users size={18} />}>
                <div className="space-y-2.5">
                  {Object.entries(res.ensemble.members).map(([k, v]: any) => (
                    <Bar key={k} label={k} value={v} color={v >= 0.5 ? "#ef4444" : "#10b981"} />
                  ))}
                </div>
              </Card>
              <Card title={`What-if: ${focus}`} subtitle="Risk as this feature sweeps its range (others fixed)" icon={<GitCompareArrows size={18} />}>
                <LineChart
                  x={res.what_if[focus].x}
                  series={[{ name: "Predicted risk", y: res.what_if[focus].risk, color: "#ef4444" }]}
                  xLabel={focus}
                  marker={f[focus]}
                  height={140}
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  {(Object.keys(res.what_if) as (keyof Features)[]).map((k) => (
                    <button key={k} onClick={() => setFocus(k)}
                      className={`rounded-full px-2 py-0.5 text-[11px] ${focus === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{k}</button>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )}
        {!res && !error && <Card><Loader2 className="animate-spin text-muted-foreground" /></Card>}
      </div>
    </div>
  );
}

function Segmented({ label, options, value, onChange }: { label: string; options: string[]; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-sm text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o, i) => (
          <button key={o} onClick={() => onChange(i)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${value === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
