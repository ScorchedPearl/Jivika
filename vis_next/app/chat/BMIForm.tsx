"use client";

import { useState } from "react";
import { Field, inputClass } from "@/app/components/Site/form";
import { Choices, ToolForm, type ToolFormProps } from "./_components/ToolForm";

type Unit = "metric" | "imperial";

export const BMIForm = ({ isOpen, onClose, onSubmit }: ToolFormProps) => {
  const [unit, setUnit] = useState<Unit>("metric");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!height || !weight) {
      setError("Please enter your height and weight.");
      return;
    }

    const heightCm = unit === "metric" ? Number(height) : Number(height) * 2.54;
    const weightKg = unit === "metric" ? Number(weight) : Number(weight) * 0.45359;
    if (heightCm < 80 || heightCm > 250 || weightKg < 20 || weightKg > 350) {
      setError("Those numbers look off. Please check the units and try again.");
      return;
    }

    const heightUnit = unit === "metric" ? "cm" : "in";
    const weightUnit = unit === "metric" ? "kg" : "lb";
    const prompt = `Please work out my BMI. Height: ${height} ${heightUnit}. Weight: ${weight} ${weightUnit}.${age ? ` Age: ${age}.` : ""}`;

    onSubmit(prompt, {
      height_cm: Math.round(heightCm * 10) / 10,
      weight_kg: Math.round(weightKg * 10) / 10,
      age: age ? Number(age) : null,
    });
  };

  if (!isOpen) return null;

  return (
    <ToolForm
      title="BMI check"
      subtitle="Body mass index compares your weight with your height."
      submitLabel="Work out my BMI"
      error={error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <Choices
        legend="Units"
        options={[
          { value: "metric", label: "cm and kg" },
          { value: "imperial", label: "inches and lb" },
        ]}
        value={unit}
        onChange={setUnit}
        columns={2}
      />

      <div className="grid grid-cols-2 gap-4">
        <Field label={`Height (${unit === "metric" ? "cm" : "in"})`}>
          <input type="number" inputMode="decimal" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} className={inputClass} />
        </Field>
        <Field label={`Weight (${unit === "metric" ? "kg" : "lb"})`}>
          <input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <Field label="Age (optional)" hint="BMI categories are for adults aged 18 and over.">
        <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} className={inputClass} />
      </Field>
    </ToolForm>
  );
};
