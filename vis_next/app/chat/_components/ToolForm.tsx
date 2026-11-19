import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/app/components/Site/form";
import { cn } from "@/lib/utils";

export interface ToolFormProps {
  isOpen: boolean;
  onClose: () => void;
  // features are the structured values a model or calculator needs
  onSubmit: (prompt: string, features?: Record<string, unknown>) => void;
}

// The shared frame of a health-check form
export function ToolForm({
  title,
  subtitle,
  submitLabel,
  error,
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  submitLabel: string;
  error: string;
  onSubmit: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="max-h-[85dvh] animate-rise overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-2xl text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      <div className="space-y-5">{children}</div>

      {error && (
        <div className="mt-4">
          <FormAlert>{error}</FormAlert>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}

// A set of options where each one can carry a line of explanation
export function Choices<T extends string>({
  legend,
  options,
  value,
  onChange,
  columns = 1,
}: {
  legend: string;
  options: { value: T; label: string; hint?: string }[];
  value: T | "";
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink-soft">{legend}</legend>
      <div className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "grid-cols-3")}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "cursor-pointer rounded-xl border px-3.5 py-2.5 transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-[var(--brand-tint)]",
              value === option.value ? "border-[var(--brand-ink)] bg-brand-tint" : "border-border bg-background hover:border-foreground/25",
            )}
          >
            <input
              type="radio"
              name={legend}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="block text-sm font-medium text-foreground">{option.label}</span>
            {option.hint && <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export type Answer = "yes" | "no" | "unsure";

// One question on a row, answered with a tap
export function YesNo({
  question,
  hint,
  value,
  onChange,
  allowUnsure = false,
}: {
  question: string;
  hint?: string;
  value: Answer | "";
  onChange: (value: Answer) => void;
  allowUnsure?: boolean;
}) {
  const options: { value: Answer; label: string }[] = [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
    ...(allowUnsure ? [{ value: "unsure" as const, label: "Not sure" }] : []),
  ];

  return (
    <fieldset className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <legend className="sr-only">{question}</legend>
      <div className="min-w-0 flex-1 basis-56" aria-hidden>
        <p className="text-sm font-medium text-ink-soft">{question}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex gap-1.5">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-[var(--brand-tint)]",
              value === option.value
                ? "border-[var(--brand-ink)] bg-brand-tint font-medium text-foreground"
                : "border-border bg-background text-ink-soft hover:border-foreground/25",
            )}
          >
            <input
              type="radio"
              name={question}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// "Not sure" and unanswered both go to the model as a blank
export const answerValue = (answer: Answer | "") => (answer === "yes" ? true : answer === "no" ? false : null);
