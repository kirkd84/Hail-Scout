"use client";

/**
 * Decorative topographic contour background.
 *
 * Renders concentric, irregular contour rings reminiscent of a USGS
 * topographic map. Used behind hero sections and empty states.
 *
 * The shapes are deterministic (seeded) so SSR + hydration match.
 */
import { cn } from "@/lib/utils";

interface ContourBgProps {
  className?: string;
  /** Density of contour rings. */
  density?: "sparse" | "normal" | "dense";
  /** Whether to fade out toward the bottom. Useful when text floats over it. */
  fadeBottom?: boolean;
}

export function ContourBg({ className, density = "normal", fadeBottom = true }: ContourBgProps) {
  const ringCount = density === "sparse" ? 6 : density === "dense" ? 14 : 10;

  // Seeded "noise" for organic-but-stable rings
  const rings = Array.from({ length: ringCount }).map((_, i) => {
    const seed = (i + 1) * 17;
    const r = 60 + i * 38 + ((seed * 7) % 14);
    const cx = 50 + ((seed * 3) % 14) - 7;
    const cy = 50 + ((seed * 5) % 12) - 6;
    const wob = 6 + ((seed * 2) % 8);
    return { r, cx, cy, wob, key: `c${i}` };
  });

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <svg
        className="h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          maskImage: fadeBottom
            ? "linear-gradient(to bottom, black 35%, transparent 95%)"
            : undefined,
          WebkitMaskImage: fadeBottom
            ? "linear-gradient(to bottom, black 35%, transparent 95%)"
            : undefined,
        }}
      >
        {rings.map(({ r, cx, cy, wob, key }, i) => (
          <ellipse
            key={key}
            cx={cx}
            cy={cy}
            rx={r * 0.9}
            ry={r * 0.6 + (wob * 0.3)}
            fill="none"
            stroke="hsl(var(--teal-700))"
            strokeWidth={i % 4 === 3 ? 0.18 : 0.1}
            opacity={i % 4 === 3 ? 0.45 : 0.22}
          />
        ))}
        {/* A single copper trail — the storm path through the contours */}
        <path
          d="M5,72 Q28,55 48,62 T78,52 T98,40"
          fill="none"
          stroke="hsl(var(--copper-500))"
          strokeWidth="0.5"
          strokeLinecap="round"
          opacity="0.7"
        />
        <circle cx="48" cy="62" r="0.9" fill="hsl(var(--copper-500))" />
        <circle cx="78" cy="52" r="0.9" fill="hsl(var(--copper-500))" />
        <circle cx="98" cy="40" r="1.1" fill="hsl(var(--copper-500))" />
      </svg>
    </div>
  );
}
