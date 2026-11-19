import { Container } from "./Container";

// Top of an inner page: eyebrow, serif title and a short intro on the soft glow
export function PageHero({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  intro?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="-mt-16 bg-glow pt-16">
      <Container className="animate-rise pt-12 pb-10 sm:pt-16">
        <p className="font-mono text-xs tracking-wider text-brand uppercase">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{intro}</p>}
        {children}
      </Container>
    </section>
  );
}
