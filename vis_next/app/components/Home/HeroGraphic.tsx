import { cn } from "@/lib/utils";

// A heartbeat trace running across orbiting rings, with the kinds of input Jivika reads floating around it.

const C = 240; // centre of the 480×480 canvas
const TRACE = "M24 244 H150 l12 -16 12 16 h14 l10 22 18 -124 20 160 14 -58 h22 l14 -22 16 22 H456";

const orbit = [-60, 30, 120, 210].map((deg, i) => {
  const a = (deg * Math.PI) / 180;
  return { x: +(C + 190 * Math.cos(a)).toFixed(1), y: +(C + 190 * Math.sin(a)).toFixed(1), delay: `${i * 0.4}s` };
});

const chips = [
  { text: "Brain MRI", className: "left-[2%] top-[14%]", delay: "0s" },
  { text: "Chest X-ray", className: "right-[0%] top-[26%]", delay: "-2s" },
  { text: "Wound photo", className: "left-[0%] bottom-[20%]", delay: "-4s" },
  { text: "Heart check", className: "right-[6%] bottom-[8%]", delay: "-1s", accent: true },
];

export function HeroGraphic() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[480px]" aria-hidden>
      <svg viewBox="0 0 480 480" className="relative h-full w-full overflow-visible">
        <defs>
          <linearGradient id="hg-brand" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--grad-a)" />
            <stop offset="1" stopColor="var(--grad-b)" />
          </linearGradient>
          <radialGradient id="hg-core">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.2" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={C} cy={C} r="170" fill="url(#hg-core)" />

        <g className="hg-spin" fill="none" stroke="var(--border)">
          <circle cx={C} cy={C} r="108" strokeDasharray="2 6" />
          <circle cx={C} cy={C} r="190" strokeDasharray="2 8" />
          <circle cx={C} cy={C} r="232" strokeDasharray="1 10" opacity="0.7" />
        </g>

        {orbit.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r="5" fill="var(--primary)" className="hg-node" style={{ animationDelay: n.delay }} />
        ))}

        <path d={TRACE} fill="none" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={TRACE}
          pathLength={1}
          fill="none"
          stroke="url(#hg-brand)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="hg-trace"
        />
      </svg>

      {chips.map((chip) => (
        <span
          key={chip.text}
          style={{ animationDelay: chip.delay }}
          className={cn(
            "hg-float absolute rounded-full border bg-card px-3 py-1.5 font-mono text-xs shadow-sm",
            chip.accent ? "border-[var(--brand-line)] text-brand" : "border-border text-ink-soft",
            chip.className,
          )}
        >
          {chip.text}
        </span>
      ))}
    </div>
  );
}
