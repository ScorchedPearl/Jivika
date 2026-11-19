"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;

export function Card({ title, subtitle, icon, children, className = "" }: {
  title?: string; subtitle?: string; icon?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`rounded-2xl border border-border bg-card/60 p-5 ${className}`}
    >
      {title && (
        <div className="mb-4 flex items-start gap-3">
          {icon && <div className="mt-0.5 text-brand">{icon}</div>}
          <div>
            <h3 className="font-serif text-lg leading-snug text-foreground">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </motion.div>
  );
}

/** Animated circular gauge, 0..1. */
export function Ring({ value, label, size = 132, color = "var(--brand-ink)" }: {
  value: number; label: string; size?: number; color?: string;
}) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" strokeWidth={10} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={10} fill="none" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-2xl text-foreground">{pct(value)}</span>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

export function Bar({ label, value, err, highlight, color, right }: {
  label: string; value: number; err?: number; highlight?: boolean; color?: string; right?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className={highlight ? "font-semibold text-foreground" : "text-muted-foreground"}>{label}</span>
        <span className="tabular-nums text-foreground">
          {right ?? pct(value, 1)}
          {err !== undefined && <span className="text-muted-foreground"> ± {pct(err, 1)}</span>}
        </span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color ?? (highlight ? "var(--brand-ink)" : "color-mix(in oklab, var(--brand-ink) 45%, var(--surface-2))") }}
          initial={{ width: 0 }}
          animate={{ width: pct(Math.max(0, Math.min(1, value)), 2) }}
          transition={{ duration: 0.8 }}
        />
        {err !== undefined && err > 0 && (
          <div
            className="absolute top-0 h-full bg-foreground/25"
            style={{ left: pct(Math.max(0, value - err), 2), width: pct(Math.min(1, value + err) - Math.max(0, value - err), 2) }}
          />
        )}
      </div>
    </div>
  );
}

/** Simple multi-series line chart in SVG. */
export function LineChart({ x, series, height = 150, xLabel, yLabel, marker }: {
  x: number[]; series: { name: string; y: number[]; color: string; dashed?: boolean }[];
  height?: number; xLabel?: string; yLabel?: string; marker?: number;
}) {
  const W = 320, H = height, P = 28;
  const xmin = Math.min(...x), xmax = Math.max(...x);
  const sx = (v: number) => P + ((v - xmin) / (xmax - xmin || 1)) * (W - P - 8);
  const sy = (v: number) => H - P + 4 - v * (H - P - 8);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={P} x2={W - 8} y1={sy(t)} y2={sy(t)} stroke="var(--border)" />
            <text x={P - 4} y={sy(t) + 3} textAnchor="end" fontSize={9} fill="var(--muted-foreground)">{t * 100}%</text>
          </g>
        ))}
        {marker !== undefined && (
          <line x1={sx(marker)} x2={sx(marker)} y1={4} y2={H - P + 4} stroke="var(--foreground)" strokeDasharray="3 3" opacity={0.6} />
        )}
        {series.map((s) => (
          <motion.polyline
            key={s.name}
            fill="none" stroke={s.color} strokeWidth={2.2} strokeDasharray={s.dashed ? "5 4" : undefined}
            points={s.y.map((v, i) => `${sx(x[i])},${sy(v)}`).join(" ")}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }}
          />
        ))}
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">{xLabel}</text>
        {yLabel && <text x={4} y={10} fontSize={9} fill="var(--muted-foreground)">{yLabel}</text>}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-0.5 w-4" style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "good" | "warn" | "bad" }) {
  const tones = {
    default: "bg-surface-2 text-muted-foreground",
    good: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    warn: "bg-amber-500/15 text-amber-600",
    bad: "bg-red-500/15 text-red-600",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
