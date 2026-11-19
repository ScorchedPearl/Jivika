"use client";

import { useState } from "react";
import { Field, inputClass } from "@/app/components/Site/form";
import { ToolForm, type ToolFormProps } from "./_components/ToolForm";

export const BloodPressureForm = ({ isOpen, onClose, onSubmit }: ToolFormProps) => {
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!systolic || !diastolic) {
      setError("Please enter both numbers from your reading.");
      return;
    }
    if (Number(diastolic) >= Number(systolic)) {
      setError("The upper number should be higher than the lower number.");
      return;
    }

    const prompt = `Please check my blood pressure reading: ${systolic}/${diastolic} mmHg.${heartRate ? ` Heart rate: ${heartRate} bpm.` : ""}`;

    onSubmit(prompt, {
      systolic: Number(systolic),
      diastolic: Number(diastolic),
      heart_rate: heartRate ? Number(heartRate) : null,
    });
  };

  if (!isOpen) return null;

  return (
    <ToolForm
      title="Blood pressure check"
      subtitle="Enter a reading from a home monitor or a clinic visit."
      submitLabel="Check my reading"
      error={error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Upper number (systolic)">
          <input type="number" inputMode="numeric" value={systolic} onChange={(e) => setSystolic(e.target.value)} placeholder="e.g. 120" className={inputClass} />
        </Field>
        <Field label="Lower number (diastolic)">
          <input type="number" inputMode="numeric" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} placeholder="e.g. 80" className={inputClass} />
        </Field>
      </div>

      <Field label="Heart rate (optional)" hint="Beats per minute, if your monitor shows it.">
        <input type="number" inputMode="numeric" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} placeholder="e.g. 72" className={inputClass} />
      </Field>
    </ToolForm>
  );
};
