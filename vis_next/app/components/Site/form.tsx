import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-[var(--brand-ink)] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand-tint)]";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function FormAlert({ tone = "error", children }: { tone?: "error" | "success"; children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        tone === "error" ? "bg-destructive/10 text-destructive" : "bg-brand-tint text-brand",
      )}
    >
      {children}
    </p>
  );
}
