"use client";

import { Heart, Moon, Sun, Zap } from "lucide-react";
import { useTheme } from "@/app/context/ThemeContext";
import { cn } from "@/lib/utils";

const themes = [
  { name: "light", icon: Sun, label: "Light theme" },
  { name: "dark", icon: Moon, label: "Dark theme" },
  { name: "rose", icon: Heart, label: "Rose theme" },
  { name: "thunder", icon: Zap, label: "Thunder theme" },
] as const;

export default function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme, mounted } = useTheme();

  return (
    <div role="group" aria-label="Theme" className={cn("inline-flex items-center gap-0.5 rounded-full border border-border bg-card/60 p-0.5", className)}>
      {themes.map(({ name, icon: Icon, label }) => {
        const isActive = mounted && theme === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() => setTheme(name)}
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            className={cn(
              "rounded-full p-1.5 transition",
              isActive ? "bg-brand-tint text-brand" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
