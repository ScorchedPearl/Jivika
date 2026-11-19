import { Container } from "@/app/components/Site/Container";

const stack = ["LangGraph", "PyTorch", "scikit-learn", "FastAPI", "Spring Boot", "PostgreSQL", "Next.js"];

export function TechStack() {
  return (
    <section className="border-y border-border bg-surface py-10">
      <Container className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
        <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">Under the hood</p>
        <ul className="flex flex-wrap justify-center gap-2">
          {stack.map((name) => (
            <li key={name} className="rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-xs text-ink-soft">
              {name}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
