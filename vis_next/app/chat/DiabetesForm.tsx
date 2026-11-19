"use client";

import { useState } from "react";
import { Field, inputClass } from "@/app/components/Site/form";
import { type Answer, answerValue, Choices, ToolForm, type ToolFormProps, YesNo } from "./_components/ToolForm";

type Sex = "F" | "M";
type Health = "excellent" | "very_good" | "good" | "fair" | "poor";

const sexOptions: { value: Sex; label: string }[] = [
  { value: "F", label: "Female" },
  { value: "M", label: "Male" },
];

const healthOptions: { value: Health; label: string }[] = [
  { value: "excellent", label: "Excellent" },
  { value: "very_good", label: "Very good" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

// Questions the model needs a firm yes or no for
const historyQuestions = [
  { key: "active", question: "Have you exercised in the past month?", hint: "Any activity outside your job, such as walking, sport or yoga." },
  { key: "smoker", question: "Have you smoked 100 cigarettes or more in your life?", hint: "That is about five packs." },
  { key: "heart_disease", question: "Have you ever had heart disease or a heart attack?" },
  { key: "stroke", question: "Have you ever had a stroke?" },
  { key: "difficulty_walking", question: "Do you have serious difficulty walking or climbing stairs?" },
] as const;

type HistoryKey = (typeof historyQuestions)[number]["key"];

export const DiabetesForm = ({ isOpen, onClose, onSubmit }: ToolFormProps) => {
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex | "">("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [health, setHealth] = useState<Health | "">("");
  const [highBp, setHighBp] = useState<Answer | "">("");
  const [highCholesterol, setHighCholesterol] = useState<Answer | "">("");
  const [history, setHistory] = useState<Record<HistoryKey, Answer | "">>({
    active: "",
    smoker: "",
    heart_disease: "",
    stroke: "",
    difficulty_walking: "",
  });
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const unanswered = historyQuestions.some(({ key }) => !history[key]);
    if (!age || !sex || !height || !weight || !health || !highBp || !highCholesterol || unanswered) {
      setError("Please answer every question. You can choose “Not sure” for blood pressure and cholesterol.");
      return;
    }
    const years = Number(age);
    const heightCm = Number(height);
    const weightKg = Number(weight);
    if (years < 18 || years > 110) {
      setError("This check is for adults aged 18 and over.");
      return;
    }
    if (heightCm < 80 || heightCm > 250 || weightKg < 20 || weightKg > 350) {
      setError("Height should be in centimetres and weight in kilograms. Please check them.");
      return;
    }

    const healthLabel = healthOptions.find((o) => o.value === health)!.label.toLowerCase();
    const said = [
      highBp === "yes" && "high blood pressure",
      highCholesterol === "yes" && "high cholesterol",
      history.active === "no" && "no regular exercise",
      history.smoker === "yes" && "a history of smoking",
      history.heart_disease === "yes" && "heart disease",
      history.stroke === "yes" && "a past stroke",
      history.difficulty_walking === "yes" && "difficulty walking",
    ].filter(Boolean);

    const prompt =
      `Please check my diabetes risk. Age ${age}, ${sex === "M" ? "male" : "female"}, ${height} cm, ${weight} kg. ` +
      `General health: ${healthLabel}.` +
      (said.length ? ` I have ${said.join(", ")}.` : "");

    onSubmit(prompt, {
      age: years,
      sex,
      height_cm: heightCm,
      weight_kg: weightKg,
      general_health: health,
      high_bp: answerValue(highBp),
      high_cholesterol: answerValue(highCholesterol),
      ...Object.fromEntries(historyQuestions.map(({ key }) => [key, answerValue(history[key])])),
    });
  };

  if (!isOpen) return null;

  return (
    <ToolForm
      title="Diabetes risk check"
      subtitle="A model trained on 250,000 health survey answers estimates your chance of diabetes or prediabetes. No blood test needed, and it takes about a minute."
      submitLabel="Check my risk"
      error={error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Age">
          <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 45" className={inputClass} />
        </Field>
        <Choices legend="Sex" options={sexOptions} value={sex} onChange={setSex} columns={3} />
        <Field label="Height (cm)">
          <input type="number" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 168" className={inputClass} />
        </Field>
        <Field label="Weight (kg)">
          <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 72" className={inputClass} />
        </Field>
      </div>

      <Choices legend="How would you rate your health in general?" options={healthOptions} value={health} onChange={setHealth} columns={3} />

      <div className="space-y-4 rounded-xl bg-surface p-4">
        <YesNo question="Has a doctor told you that you have high blood pressure?" value={highBp} onChange={setHighBp} allowUnsure />
        <YesNo question="Has a doctor told you that you have high cholesterol?" value={highCholesterol} onChange={setHighCholesterol} allowUnsure />
        {historyQuestions.map(({ key, question, ...rest }) => (
          <YesNo
            key={key}
            question={question}
            hint={"hint" in rest ? rest.hint : undefined}
            value={history[key]}
            onChange={(answer) => setHistory((current) => ({ ...current, [key]: answer }))}
          />
        ))}
      </div>
    </ToolForm>
  );
};
