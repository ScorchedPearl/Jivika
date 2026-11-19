import Link from "next/link";
import { Container } from "./Container";
import { Logo } from "./Logo";
import { nav } from "./nav";

const team = ["Saumya Sood", "Vishwas Pahwa", "Kyan Mahajan", "Vaidik Kathal"];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            An AI health assistant for everyday questions, scans and wound photos, and finding care nearby.
          </p>
        </div>

        <div>
          <h3 className="font-mono text-xs tracking-wider text-muted-foreground uppercase">Explore</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-ink-soft hover:text-brand">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-mono text-xs tracking-wider text-muted-foreground uppercase">Built by</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-soft">
            {team.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      </Container>

      <div className="border-t border-border">
        <Container className="flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Jivika</p>
          <p>Jivika gives general guidance and is not a substitute for a doctor.</p>
        </Container>
      </div>
    </footer>
  );
}
