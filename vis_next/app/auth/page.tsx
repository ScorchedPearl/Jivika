"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, LogIn, Stethoscope, UserRound } from "lucide-react";
import { SiteShell } from "../components/Site/SiteShell";
import { AuthCard } from "./_components/AuthCard";

const roles = [
  { label: "I'm a patient", detail: "Chat, check your health, book a doctor", icon: UserRound, path: "/auth/user" },
  { label: "I'm a doctor", detail: "Manage your appointment requests", icon: Stethoscope, path: "/auth/doctor" },
];

function RoleSelect() {
  const redirect = useSearchParams().get("redirect");
  const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";

  return (
    <AuthCard icon={LogIn} title="Welcome to Jivika" subtitle="Tell us who's signing in.">
      <div className="space-y-3">
        {roles.map(({ label, detail, icon: Icon, path }) => (
          <Link
            key={path}
            href={`${path}${query}`}
            className="group flex items-center gap-3 rounded-xl border border-border bg-background p-3.5 transition hover:border-[var(--brand-line)] hover:bg-surface"
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
              <Icon size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{label}</span>
              <span className="block text-xs text-muted-foreground">{detail}</span>
            </span>
            <ArrowRight size={15} className="shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand" />
          </Link>
        ))}
      </div>
    </AuthCard>
  );
}

export default function AuthRoleSelectPage() {
  return (
    <SiteShell footer={false}>
      <Suspense>
        <RoleSelect />
      </Suspense>
    </SiteShell>
  );
}
