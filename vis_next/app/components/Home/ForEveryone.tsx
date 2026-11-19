import { ArrowRight, Stethoscope, UserRound } from "lucide-react";
import Link from "next/link";
import { Container } from "@/app/components/Site/Container";
import { SectionHeading } from "@/app/components/Site/SectionHeading";

const roles = [
  {
    icon: UserRound,
    eyebrow: "For patients",
    title: "Understand it, then act on it",
    points: ["Chat history saved to your account", "Guided checks for common concerns", "Request appointments with doctors"],
    href: "/auth/user",
    cta: "Sign in as a patient",
  },
  {
    icon: Stethoscope,
    eyebrow: "For doctors",
    title: "Meet patients who are prepared",
    points: ["A profile patients can find", "Your hospital listed with your name", "Appointment requests in one list"],
    href: "/auth/doctor",
    cta: "Sign in as a doctor",
  },
];

export function ForEveryone() {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <SectionHeading eyebrow="Two sides of care" title="Built for patients and the doctors they see" align="center" />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {roles.map(({ icon: Icon, eyebrow, title, points, href, cta }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col rounded-2xl border border-border bg-card/60 p-7 transition hover:-translate-y-0.5 hover:border-[var(--brand-line)] hover:bg-card"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-tint text-brand">
                <Icon size={20} />
              </span>
              <p className="mt-5 font-mono text-xs tracking-wider text-muted-foreground uppercase">{eyebrow}</p>
              <h3 className="mt-2 font-serif text-2xl text-foreground group-hover:text-brand">{title}</h3>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {points.map((point) => (
                  <li key={point} className="flex gap-2.5">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    {point}
                  </li>
                ))}
              </ul>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand">
                {cta} <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
