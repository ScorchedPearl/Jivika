"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Field, inputClass } from "@/app/components/Site/form";
import { cn } from "@/lib/utils";
import { type Answer, answerValue, Choices, ToolForm, type ToolFormProps, YesNo } from "./_components/ToolForm";

// Codes the heart model was trained with
type Sex = "F" | "M";
type ChestPain = "ASY" | "NAP" | "ATA" | "TA";
type StSlope = "Up" | "Flat" | "Down";
type RestingEcg = "Normal" | "ST" | "LVH";

const sexOptions: { value: Sex; label: string }[] = [
  { value: "F", label: "Female" },
  { value: "M", label: "Male" },
];

const chestPainOptions: { value: ChestPain; label: string; hint: string }[] = [
  { value: "ASY", label: "No chest pain", hint: "You don't get chest pain or tightness." },
  { value: "TA", label: "Typical angina", hint: "Pressure or tightness when active that eases with rest." },
  { value: "ATA", label: "Atypical angina", hint: "Chest discomfort with only some of those features." },
  { value: "NAP", label: "Other chest pain", hint: "Sharp or brief pain, or pain that changes with breathing or position." },
];

const slopeOptions: { value: StSlope; label: string }[] = [
  { value: "Up", label: "Upsloping" },
  { value: "Flat", label: "Flat" },
  { value: "Down", label: "Downsloping" },
];

const ecgOptions: { value: RestingEcg; label: string }[] = [
  { value: "Normal", label: "Normal" },
  { value: "ST", label: "ST-T changes" },
  { value: "LVH", label: "LV hypertrophy" },
];

const numberOrNull = (text: string) => (text === "" ? null : Number(text));

export const HeartForm = ({ isOpen, onClose, onSubmit }: ToolFormProps) => {
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex | "">("");
  const [chestPain, setChestPain] = useState<ChestPain | "">("");
  const [restingBp, setRestingBp] = useState("");
  const [cholesterol, setCholesterol] = useState("");
  const [highSugar, setHighSugar] = useState<Answer | "">("");

  const [hasStressTest, setHasStressTest] = useState(false);
  const [maxHr, setMaxHr] = useState("");
  const [exerciseAngina, setExerciseAngina] = useState<Answer | "">("");
  const [oldpeak, setOldpeak] = useState("");
  const [stSlope, setStSlope] = useState<StSlope | "">("");
  const [restingEcg, setRestingEcg] = useState<RestingEcg | "">("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!age || !sex || !chestPain) {
      setError("Please give your age, sex and whether you get chest pain. Everything else can be left blank.");
      return;
    }
    const years = Number(age);
    if (years < 18 || years > 100) {
      setError("This check is for adults aged 18 to 100.");
      return;
    }
    const checks: [string, string, number, number][] = [
      ["Resting blood pressure", restingBp, 70, 250],
      ["Cholesterol", cholesterol, 80, 700],
      ["Maximum heart rate", hasStressTest ? maxHr : "", 60, 220],
      ["ST depression", hasStressTest ? oldpeak : "", -3, 7],
    ];
    for (const [name, text, low, high] of checks) {
      if (text !== "" && (Number(text) < low || Number(text) > high)) {
        setError(`${name} should be between ${low} and ${high}.`);
        return;
      }
    }

    const painLabel = chestPainOptions.find((o) => o.value === chestPain)!.label.toLowerCase();
    const parts = [
      `Age ${age}, ${sex === "M" ? "male" : "female"}`,
      `Chest pain: ${painLabel}`,
      restingBp && `Resting blood pressure: ${restingBp} mmHg`,
      cholesterol && `Cholesterol: ${cholesterol} mg/dL`,
      highSugar === "yes" && "Fasting blood sugar above 120 mg/dL",
      hasStressTest && maxHr && `Maximum heart rate: ${maxHr} bpm`,
      hasStressTest && exerciseAngina === "yes" && "Chest pain during exercise",
      hasStressTest && oldpeak && `ST depression: ${oldpeak}`,
      hasStressTest && stSlope && `${slopeOptions.find((o) => o.value === stSlope)!.label} ST segment`,
    ].filter(Boolean);

    onSubmit(`Please check my heart risk. ${parts.join(". ")}.`, {
      age: years,
      sex,
      chest_pain: chestPain,
      resting_bp: numberOrNull(restingBp),
      cholesterol: numberOrNull(cholesterol),
      high_fasting_sugar: answerValue(highSugar),
      max_hr: hasStressTest ? numberOrNull(maxHr) : null,
      exercise_angina: hasStressTest ? answerValue(exerciseAngina) : null,
      oldpeak: hasStressTest ? numberOrNull(oldpeak) : null,
      st_slope: hasStressTest && stSlope ? stSlope : null,
      resting_ecg: hasStressTest && restingEcg ? restingEcg : null,
    });
  };

  if (!isOpen) return null;

  return (
    <ToolForm
      title="Heart risk check"
      subtitle="A model estimates your risk of heart disease. Three answers are enough to start, and every extra value you add makes it more accurate."
      submitLabel="Check my risk"
      error={error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Age">
          <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 52" className={inputClass} />
        </Field>
        <Choices legend="Sex" options={sexOptions} value={sex} onChange={setSex} columns={3} />
      </div>

      <Choices legend="Do you get chest pain?" options={chestPainOptions} value={chestPain} onChange={setChestPain} columns={2} />

      <div className="space-y-4 rounded-xl bg-surface p-4">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">If you know them</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Resting blood pressure" hint="The upper number, in mmHg.">
            <input type="number" inputMode="numeric" value={restingBp} onChange={(e) => setRestingBp(e.target.value)} placeholder="e.g. 130" className={inputClass} />
          </Field>
          <Field label="Cholesterol" hint="Total cholesterol, in mg/dL.">
            <input type="number" inputMode="numeric" value={cholesterol} onChange={(e) => setCholesterol(e.target.value)} placeholder="e.g. 200" className={inputClass} />
          </Field>
        </div>
        <YesNo question="Is your fasting blood sugar above 120 mg/dL?" value={highSugar} onChange={setHighSugar} allowUnsure />
      </div>

      <div className="rounded-xl border border-border">
        <button
          type="button"
          aria-expanded={hasStressTest}
          onClick={() => setHasStressTest((open) => !open)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span>
            <span className="block text-sm font-medium text-foreground">I have an exercise ECG (stress test) report</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Adding it raises the model&apos;s accuracy from about 78% to 86%.</span>
          </span>
          <ChevronDown size={18} className={cn("shrink-0 text-muted-foreground transition", hasStressTest && "rotate-180")} />
        </button>

        {hasStressTest && (
          <div className="space-y-4 border-t border-border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Maximum heart rate" hint="The highest rate reached, in bpm.">
                <input type="number" inputMode="numeric" value={maxHr} onChange={(e) => setMaxHr(e.target.value)} placeholder="e.g. 150" className={inputClass} />
              </Field>
              <Field label="ST depression (oldpeak)" hint="Usually between 0 and 4.">
                <input type="number" inputMode="decimal" step="0.1" value={oldpeak} onChange={(e) => setOldpeak(e.target.value)} placeholder="e.g. 1.0" className={inputClass} />
              </Field>
            </div>
            <YesNo question="Did you get chest pain during the test?" value={exerciseAngina} onChange={setExerciseAngina} />
            <Choices legend="Slope of the ST segment" options={slopeOptions} value={stSlope} onChange={setStSlope} columns={3} />
            <Choices legend="Resting ECG" options={ecgOptions} value={restingEcg} onChange={setRestingEcg} columns={3} />
          </div>
        )}
      </div>
    </ToolForm>
  );
};
