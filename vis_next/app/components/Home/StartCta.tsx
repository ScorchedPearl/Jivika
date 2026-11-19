import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Container } from "@/app/components/Site/Container";

export function StartCta() {
  return (
    <section>
      <Container>
        <div className="relative overflow-hidden rounded-3xl bg-brand-gradient px-6 py-14 text-center text-on-brand sm:px-12 sm:py-16">
          <div
            aria-hidden
            className="absolute inset-0 opacity-30 [background:radial-gradient(40%_60%_at_15%_10%,rgb(255_255_255/0.5),transparent_70%),radial-gradient(35%_50%_at_90%_100%,rgb(255_255_255/0.3),transparent_70%)]"
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl font-serif text-3xl leading-tight sm:text-4xl">Something on your mind? Ask it now.</h2>
            <p className="mx-auto mt-4 max-w-xl opacity-80">It takes a minute to start, and you'll know what to do next.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 rounded-full bg-on-brand px-5 py-2.5 text-sm font-medium text-[var(--brand-from)] transition hover:opacity-90"
              >
                Start a chat <ArrowRight size={16} />
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 rounded-full border border-current/40 px-5 py-2.5 text-sm font-medium transition hover:bg-black/5"
              >
                Find a hospital
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
