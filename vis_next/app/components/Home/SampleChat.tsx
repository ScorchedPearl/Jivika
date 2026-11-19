import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { Container } from "@/app/components/Site/Container";
import { SectionHeading } from "@/app/components/Site/SectionHeading";

export function SampleChat() {
  return (
    <section className="py-20 sm:py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
        <SectionHeading
          eyebrow="In practice"
          title="Like asking someone who knows, and has time"
          intro="Answers stay short and specific. Jivika says what the result may mean, what you can do now, and when to see a doctor."
        />

        <figure className="rounded-3xl border border-border bg-card/60 p-5 sm:p-6">
          <figcaption className="mb-5 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">Example conversation</figcaption>
          <div className="space-y-4 text-sm">
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand-tint px-4 py-3 text-foreground">
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-background/70 px-2 py-1 font-mono text-xs text-ink-soft">
                <ImageIcon size={12} /> wound-photo.jpg
              </p>
              <p>I cut my hand on a tin lid this morning. Does this need stitches?</p>
            </div>
            <div className="flex gap-3">
              <Image src="/images/logo.png" alt="" width={28} height={28} className="size-7 shrink-0 rounded-full" />
              <div className="space-y-2.5 leading-relaxed text-ink-soft">
                <p className="w-fit rounded-full bg-surface px-2.5 py-1 font-mono text-[11px] text-brand uppercase">Wound model · Laceration</p>
                <p>This looks like a laceration, a cut with uneven edges.</p>
                <p>
                  <strong className="font-semibold text-foreground">For now:</strong> press with a clean cloth until the bleeding stops, then rinse gently with water.
                </p>
                <p>
                  <strong className="font-semibold text-foreground">See a doctor today</strong> if it is deep, gaping or won&apos;t stop bleeding. Metal cuts may also need a tetanus shot.
                </p>
              </div>
            </div>
          </div>
        </figure>
      </Container>
    </section>
  );
}
