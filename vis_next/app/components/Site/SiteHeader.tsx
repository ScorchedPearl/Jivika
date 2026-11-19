"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { getAuthToken } from "@/lib/auth-utils";
import { cn } from "@/lib/utils";
import ThemeSwitcher from "@/app/components/Common/ThemeSwitcher";
import { Container } from "./Container";
import { LinkButton } from "./LinkButton";
import { Logo } from "./Logo";
import { nav } from "./nav";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!getAuthToken());
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => pathname.startsWith(href);
  const cta = isLoggedIn ? { href: "/chat", label: "Open chat" } : { href: "/auth", label: "Sign in" };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        scrolled || open ? "border-border bg-background/85 backdrop-blur-md" : "border-transparent bg-transparent",
      )}
    >
      <Container className="flex h-16 items-center justify-between">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm transition",
                isActive(item.href) ? "bg-surface text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
          <span className="mx-2 h-5 w-px bg-border" aria-hidden />
          <ThemeSwitcher />
          <LinkButton href={cta.href} className="ml-2 px-4 py-2">
            {cta.label} <ArrowRight size={14} />
          </LinkButton>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeSwitcher />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="-mr-2 rounded-full p-2 text-ink-soft hover:bg-surface"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </Container>

      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-border md:hidden">
          <Container className="flex flex-col py-3">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "rounded-xl px-3 py-3 text-base",
                  isActive(item.href) ? "bg-surface text-foreground" : "text-ink-soft",
                )}
              >
                {item.label}
              </Link>
            ))}
            <LinkButton href={cta.href} className="mt-3">
              {cta.label} <ArrowRight size={16} />
            </LinkButton>
          </Container>
        </nav>
      )}
    </header>
  );
}
