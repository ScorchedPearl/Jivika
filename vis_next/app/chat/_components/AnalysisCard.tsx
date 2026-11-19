import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowUp, Info, MapPin, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Analysis } from "./analysis";

const percent = (score: number) => `${Math.round(score * 100)}%`;

function Meter({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{percent(score)}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(score * 100)}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full bg-brand-gradient" style={{ width: percent(score) }} />
      </div>
    </div>
  );
}

function ImageReading({ analysis }: { analysis: Analysis }) {
  const others = (analysis.probabilities ?? []).slice(1, 4).filter((p) => p.score >= 0.03);

  return (
    <>
      {analysis.confidence != null && <Meter label="Model confidence" score={analysis.confidence} />}

      {(analysis.image_url || analysis.heatmap_url) && (
        <div className="grid grid-cols-2 gap-3">
          {analysis.image_url && (
            <figure>
              <img src={analysis.image_url} alt="The image you shared" className="aspect-square w-full rounded-xl border border-border object-cover" />
              <figcaption className="mt-1.5 text-xs text-muted-foreground">Your image</figcaption>
            </figure>
          )}
          {analysis.heatmap_url && (
            <figure>
              <img src={analysis.heatmap_url} alt="Heatmap of the areas the model focused on" className="aspect-square w-full rounded-xl border border-border object-cover" />
              <figcaption className="mt-1.5 text-xs text-muted-foreground">Where the model looked. Red areas mattered most.</figcaption>
            </figure>
          )}
        </div>
      )}

      {others.length > 0 && (
        <div>
          <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">Other possibilities</p>
          <ul className="mt-2 space-y-1.5">
            {others.map((p) => (
              <li key={p.label} className="flex items-center gap-3 text-sm">
                <span className="w-2/5 shrink-0 truncate text-ink-soft">{p.label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-muted-foreground/50" style={{ width: percent(p.score) }} />
                </span>
                <span className="w-9 shrink-0 text-right font-mono text-xs text-muted-foreground">{percent(p.score)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function RiskReading({ analysis }: { analysis: Analysis }) {
  const meterLabel = analysis.kind === "diabetes" ? "Estimated chance of diabetes or prediabetes" : "Model risk score";
  return (
    <>
      {analysis.probability != null && <Meter label={meterLabel} score={analysis.probability} />}

      {!!analysis.factors?.length && (
        <div>
          <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">What moved the score</p>
          <ul className="mt-2 space-y-1.5">
            {analysis.factors.map((factor) => {
              const raises = factor.effect > 0;
              const Icon = raises ? ArrowUp : ArrowDown;
              return (
                <li key={factor.label} className="flex items-center gap-2.5 text-sm text-ink-soft">
                  <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full", raises ? "bg-destructive/10 text-destructive" : "bg-brand-tint text-brand")}>
                    <Icon size={12} />
                  </span>
                  <span className="flex-1">{factor.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{raises ? "raises risk" : "lowers risk"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

function Scale({ analysis }: { analysis: Analysis }) {
  const { min, max, bands } = analysis.scale!;
  const value = Number(analysis.value);
  const position = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  let from = min;

  return (
    <div aria-hidden>
      <div className="relative pt-3">
        <span className="absolute top-0 -ml-1.5 size-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-[var(--brand-ink)]" style={{ left: `${position}%` }} />
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {bands.map((band) => {
            const to = band.to ?? max;
            const width = ((to - from) / (max - min)) * 100;
            const active = band.label === analysis.label;
            from = to;
            return <span key={band.label} className={active ? "bg-brand-gradient" : "bg-surface-2"} style={{ width: `${width}%` }} />;
          })}
        </div>
      </div>
      <div className="mt-1.5 flex text-[11px] text-muted-foreground">
        {bands.map((band, i) => {
          const start = i === 0 ? min : bands[i - 1].to!;
          const width = (((band.to ?? max) - start) / (max - min)) * 100;
          return (
            <span key={band.label} className="truncate" style={{ width: `${width}%` }}>
              {band.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Steps({ analysis }: { analysis: Analysis }) {
  const { labels, current } = analysis.steps!;
  return (
    <ol className="flex flex-wrap gap-1.5">
      {labels.map((label, i) => (
        <li
          key={label}
          aria-current={i === current ? "true" : undefined}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs",
            i === current ? "bg-brand-gradient font-medium text-on-brand" : "bg-surface-2 text-muted-foreground",
          )}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}

function headline(analysis: Analysis) {
  if (analysis.kind === "heart" || analysis.kind === "diabetes") return `${analysis.band![0].toUpperCase()}${analysis.band!.slice(1)} risk`;
  return analysis.label;
}

export function AnalysisCard({ analysis }: { analysis: Analysis }) {
  const isImage = analysis.kind === "brain" || analysis.kind === "lung" || analysis.kind === "wound";
  const isCalculator = analysis.kind === "bmi" || analysis.kind === "bp";

  return (
    <section aria-label={`${analysis.title} result`} className="animate-rise overflow-hidden rounded-2xl border border-border bg-card/70">
      <div className="space-y-4 p-5">
        <header>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[11px] tracking-wider text-brand uppercase">
              {analysis.title} · {isCalculator ? "Calculated" : "AI reading"}
            </p>
            {analysis.uncertain && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-ink-soft">
                <AlertTriangle size={12} /> Not certain
              </span>
            )}
          </div>
          <h3 className="mt-2 font-serif text-2xl leading-tight text-foreground">
            {isCalculator && (
              <span className="mr-2">
                {analysis.value}
                <span className="ml-1 font-sans text-sm text-muted-foreground">{analysis.unit}</span>
              </span>
            )}
            {isCalculator ? <span className="text-brand">{headline(analysis)}</span> : headline(analysis)}
          </h3>
        </header>

        {analysis.urgent && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
            This reading needs attention today. If you feel unwell, call <a href="tel:112" className="font-semibold underline">112</a>.
          </p>
        )}

        {isImage && <ImageReading analysis={analysis} />}
        {(analysis.kind === "heart" || analysis.kind === "diabetes") && <RiskReading analysis={analysis} />}
        {analysis.scale && <Scale analysis={analysis} />}
        {analysis.steps && <Steps analysis={analysis} />}

        {!!analysis.metrics?.length && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            {analysis.metrics.map((metric) => (
              <div key={metric.label}>
                <dt className="text-xs text-muted-foreground">{metric.label}</dt>
                <dd className="font-mono text-foreground">{metric.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {analysis.uncertain && !!analysis.reasons?.length && (
          <div className="flex gap-2.5 rounded-xl bg-surface px-3.5 py-3 text-sm text-ink-soft">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
            <p>
              <span className="font-medium text-foreground">Treat this as a rough guide. </span>
              {analysis.reasons.join(" ")}
            </p>
          </div>
        )}

        {!!analysis.notes?.length && (
          <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
            {analysis.notes.map((note) => (
              <li key={note} className="flex gap-2">
                <Info size={13} className="mt-0.5 shrink-0" />
                {note}
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-5 py-3">
        <p className="min-w-0 flex-1 basis-56 text-xs text-muted-foreground">{analysis.model} Not a diagnosis.</p>
        <div className="flex gap-2">
          <Link href="/doctors" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-foreground/25">
            <Stethoscope size={13} /> Find a doctor
          </Link>
          <Link href="/explore" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-foreground/25">
            <MapPin size={13} /> Hospitals
          </Link>
        </div>
      </footer>
    </section>
  );
}
