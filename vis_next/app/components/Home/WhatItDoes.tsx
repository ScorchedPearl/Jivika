import { HeartPulse, MapPin, MessageCircle, ScanLine } from "lucide-react";
import { Container } from "@/app/components/Site/Container";
import { SectionHeading } from "@/app/components/Site/SectionHeading";

const items = [
  {
    icon: MessageCircle,
    title: "Health chat",
    body: "Ask about symptoms, medicines or habits and get a short answer in plain language. Your chats stay saved to your account.",
  },
  {
    icon: ScanLine,
    title: "Image analysis",
    body: "Share a brain MRI, chest X-ray or wound photo. The matching model reads it and shows its confidence and where it looked.",
  },
  {
    icon: HeartPulse,
    title: "Health checks",
    body: "Guided checks for heart risk, blood pressure, BMI, diabetes and symptoms, with the result shown as a card and explained in the chat.",
  },
  {
    icon: MapPin,
    title: "Care nearby",
    body: "See hospitals around you, browse doctors and request an appointment when you want a person to take a look.",
  },
];

export function WhatItDoes() {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="What Jivika does"
          title="One place to start when something feels off"
          intro="From a quick question to a scan you don't understand, Jivika helps you make sense of it and decide what to do next."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="group rounded-2xl border border-border bg-card/60 p-6 transition hover:-translate-y-0.5 hover:border-[var(--brand-line)] hover:bg-card"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-tint text-brand transition group-hover:bg-brand-gradient group-hover:text-on-brand">
                <Icon size={20} />
              </span>
              <h3 className="mt-5 font-serif text-xl text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
