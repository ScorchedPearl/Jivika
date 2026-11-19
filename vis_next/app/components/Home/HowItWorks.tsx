import { Container } from "@/app/components/Site/Container";
import { SectionHeading } from "@/app/components/Site/SectionHeading";

const steps = [
  {
    title: "Ask or upload",
    body: "Type a question, fill in a health check, or attach a scan or wound photo.",
  },
  {
    title: "The right model reads it",
    body: "Jivika checks what kind of image it is, then the matching brain, lung or wound model reads it and shows how confident it is. Heart checks go to a dedicated risk model.",
  },
  {
    title: "You get a clear next step",
    body: "The result comes back as a plain explanation of what it may mean and what to do about it, with a doctor one click away.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-surface py-20 sm:py-24">
      <Container className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              Specialist models, <em className="text-gradient">explained simply</em>
            </>
          }
          intro="Medical models give labels, and labels aren't much use on their own. Jivika turns them into something you can act on."
        />
        <ol className="relative space-y-8 border-l border-border pl-8">
          {steps.map((step, i) => (
            <li key={step.title} className="relative">
              <span className="absolute -left-[3.05rem] flex size-9 items-center justify-center rounded-full border border-border bg-background font-mono text-xs text-brand">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-serif text-xl text-foreground">{step.title}</h3>
              <p className="mt-1.5 leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
