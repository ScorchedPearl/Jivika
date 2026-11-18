"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, HeartPulse, ScanLine } from "lucide-react";
import ImagingLab from "./_components/ImagingLab";
import HeartLab from "./_components/HeartLab";
import ThemeSwitcher from "../components/Common/ThemeSwitcher";

const TECH = [
  "BALD uncertainty", "MC-dropout", "Mahalanobis / feature-norm OOD", "Grad-CAM++ · LayerCAM · Occlusion",
  "Deletion faithfulness", "PGD robustness radius", "ISTA counterfactuals", "Exact Shapley", "Algorithmic recourse",
];

export default function LabPage() {
  const [tab, setTab] = useState<"imaging" | "heart">("imaging");
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex w-[92%] max-w-[1400px] items-center justify-between py-3">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} /> Jivika
          </Link>
          <ThemeSwitcher />
        </div>
      </header>

      <section className="mx-auto w-[92%] max-w-[1400px] py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Jivika Insight Lab</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
            AI that tells you <span className="text-primary">how much to trust it.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Every diagnosis comes with calibrated uncertainty, an out-of-distribution guard, four cross-checked explanations,
            an adversarial robustness certificate and a counterfactual showing what would change the outcome.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {TECH.map((t) => (
              <span key={t} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{t}</span>
            ))}
          </div>
        </motion.div>

        <div className="mt-8 inline-flex rounded-xl bg-muted p-1">
          {([
            ["imaging", "Imaging diagnostics", <ScanLine key="i" size={16} />],
            ["heart", "Heart risk what-if", <HeartPulse key="h" size={16} />],
          ] as const).map(([k, label, icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === k ? "text-foreground" : "text-muted-foreground"}`}>
              {tab === k && <motion.span layoutId="labtab" className="absolute inset-0 rounded-lg bg-card shadow-sm" />}
              <span className="relative flex items-center gap-2">{icon}{label}</span>
            </button>
          ))}
        </div>

        <div className="mt-6">{tab === "imaging" ? <ImagingLab /> : <HeartLab />}</div>
      </section>
    </main>
  );
}
