import { ArrowRight } from "lucide-react";
import { Container } from "@/app/components/Site/Container";
import { LinkButton } from "@/app/components/Site/LinkButton";
import { HeroGraphic } from "./HeroGraphic";

export function Hero() {
  return (
    <section className="relative -mt-16 overflow-hidden bg-glow pt-16">
      <Container className="grid items-center gap-14 pt-14 pb-20 sm:pt-20 lg:grid-cols-[1.15fr_1fr] lg:pt-28 lg:pb-28">
        <div className="animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            AI health assistant
          </p>

          <h1 className="mt-6 font-serif text-[2.75rem] leading-[1.05] font-normal tracking-tight text-foreground sm:text-6xl lg:text-[4.25rem]">
            Clear answers
            <br />
            about your <em className="text-gradient pr-1 font-medium">health</em>.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Ask Jivika a question or share a scan or wound photo. You get a plain explanation and a sensible next step,
            then a doctor or hospital near you when you need one.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <LinkButton href="/chat">
              Start a chat <ArrowRight size={16} />
            </LinkButton>
            <LinkButton href="/doctors" variant="secondary">
              Find a doctor
            </LinkButton>
          </div>
        </div>

        <div className="animate-rise [animation-delay:150ms]">
          <HeroGraphic />
        </div>
      </Container>
    </section>
  );
}
