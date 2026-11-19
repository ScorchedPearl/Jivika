import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-brand-gradient text-on-brand shadow-[0_1px_0_rgb(255_255_255/0.2)_inset] hover:brightness-110",
  secondary: "border border-border bg-card/70 text-foreground hover:border-foreground/25 hover:bg-card",
  ghost: "text-ink-soft hover:bg-surface hover:text-foreground",
};

export function LinkButton({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition",
        variants[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}
