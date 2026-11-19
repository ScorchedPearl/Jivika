"use client";

import { useState } from "react";
import { HeartPulse, ScanLine } from "lucide-react";
import { Container } from "../components/Site/Container";
import { PageHero } from "../components/Site/PageHero";
import { SiteShell } from "../components/Site/SiteShell";
import { cn } from "@/lib/utils";
import HeartLab from "./_components/HeartLab";
import ImagingLab from "./_components/ImagingLab";

const TECH = [
  "BALD uncertainty",
  "MC-dropout",
  "Mahalanobis / feature-norm OOD",
  "Grad-CAM++ · LayerCAM · Occlusion",
  "Deletion faithfulness",
  "PGD robustness radius",
  "ISTA counterfactuals",
  "Exact Shapley",
  "Algorithmic recourse",
];

const TABS = [
  { key: "imaging", label: "Imaging diagnostics", icon: ScanLine },
  { key: "heart", label: "Heart risk what-if", icon: HeartPulse },
] as const;

export default function LabPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("imaging");

  return (
    <SiteShell>
      <PageHero
        eyebrow="AI Lab"
        title={
          <>
            AI that tells you <span className="text-gradient">how much to trust it.</span>
          </>
        }
        intro="Every result comes with calibrated uncertainty, an out-of-distribution check, four cross-checked explanations, an adversarial robustness test and a counterfactual that shows what would change the outcome."
      >
        <ul className="mt-6 flex flex-wrap gap-2">
          {TECH.map((t) => (
            <li key={t} className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-muted-foreground">
              {t}
            </li>
          ))}
        </ul>
      </PageHero>

      <Container className="pb-20">
        <div role="tablist" aria-label="Lab tools" className="inline-flex rounded-full border border-border bg-surface p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm transition",
                tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6" role="tabpanel">
          {tab === "imaging" ? <ImagingLab /> : <HeartLab />}
        </div>
      </Container>
    </SiteShell>
  );
}
