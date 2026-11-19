import type { LucideIcon } from "lucide-react";
import { Container } from "@/app/components/Site/Container";

export function AuthCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="-mt-16 bg-glow pt-16">
      <Container className="flex min-h-[calc(100dvh-4rem)] items-center justify-center py-12">
        <div className="w-full max-w-sm animate-rise rounded-2xl border border-border bg-card/80 p-8">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-tint text-brand">
            <Icon size={18} />
          </span>
          <h1 className="mt-5 font-serif text-3xl text-foreground">{title}</h1>
          <p className="mt-1.5 mb-6 text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </div>
      </Container>
    </section>
  );
}
