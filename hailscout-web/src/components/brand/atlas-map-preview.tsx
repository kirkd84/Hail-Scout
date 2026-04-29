"use client";

/**
 * "Atlas" stylized map preview — the hero showpiece.
 *
 * Pure SVG. No MapLibre, no tiles. Renders a hand-drawn-feeling
 * rectangular atlas plate with:
 *   - cream paper background
 *   - subtle topographic contour lines
 *   - a "storm path" copper polyline crossing the plate
 *   - 3 storm markers (sized by impact, colored by hail size)
 *   - graticule edge ticks (compass-like) on each side
 *   - a small "scale bar" and "north arrow"
 *
 * The storm path animates a draw-on once on mount so the hero
 * has a small but unmistakable moment of motion.
 */
import { useEffect, useRef } from "react";

const STORMS = [
  { x: 22, y: 58, size: 8,  hail: "1.75\"", label: "Dallas-Fort Worth, TX" },
  { x: 48, y: 50, size: 11, hail: "2.50\"", label: "Oklahoma City, OK" },
  { x: 78, y: 38, size: 6,  hail: "1.25\"", label: "Wichita, KS" },
];

export function AtlasMapPreview({ className }: { className?: string }) {
  const pathRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    requestAnimationFrame(() => {
      p.style.transition = "stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)";
      p.style.strokeDashoffset = "0";
    });
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border bg-card shadow-atlas-lg ${className ?? ""}`}
    >
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="block h-auto w-full">
        <defs>
          <pattern id="atlas-grid" width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M 6 0 L 0 0 0 6" fill="none" stroke="hsl(var(--border))" strokeWidth="0.08" opacity="0.6" />
          </pattern>
          <linearGradient id="paper-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="hsl(var(--cream-50))" />
            <stop offset="100%" stopColor="hsl(var(--cream-200))" />
          </linearGradient>
        </defs>

        <rect width="100" height="60" fill="url(#paper-shade)" />
        <rect width="100" height="60" fill="url(#atlas-grid)" />

        {/* Soft topographic contour lines */}
        {[8, 16, 24, 32, 40, 48].map((y, i) => (
          <path
            key={y}
            d={`M0,${y + 14} Q20,${y + 8} 40,${y + 12} T80,${y + 6} T100,${y + 4}`}
            fill="none"
            stroke="hsl(var(--teal-700))"
            strokeWidth="0.18"
            opacity={i % 2 === 0 ? 0.32 : 0.18}
          />
        ))}

        {/* Coastline-ish line for an editorial flourish */}
        <path
          d="M0,52 Q12,49 22,50 T44,46 Q60,48 72,42 T100,36"
          fill="none"
          stroke="hsl(var(--teal-700))"
          strokeWidth="0.3"
          opacity="0.55"
        />

        {/* Storm path — copper, animated draw-on */}
        <path
          ref={pathRef}
          d="M14,58 Q26,52 40,52 T62,42 T88,30"
          fill="none"
          stroke="hsl(var(--copper-500))"
          strokeWidth="0.7"
          strokeLinecap="round"
          opacity="0.95"
        />

        {/* Storm markers */}
        {STORMS.map((s) => (
          <g key={s.label}>
            <circle cx={s.x} cy={s.y} r={s.size * 0.8} fill="hsl(var(--copper-500))" opacity="0.18" />
            <circle cx={s.x} cy={s.y} r={s.size * 0.45} fill="hsl(var(--copper-500))" opacity="0.32" />
            <circle cx={s.x} cy={s.y} r="1.1" fill="hsl(var(--copper-500))" />
          </g>
        ))}

        {/* North arrow + scale bar (compass-style) */}
        <g transform="translate(92, 8)">
          <circle r="2.8" cx="0" cy="0" fill="hsl(var(--cream-50))" stroke="hsl(var(--teal-700))" strokeWidth="0.18" />
          <path d="M0,-2.4 L0.9,1.6 L0,0.9 L-0.9,1.6 Z" fill="hsl(var(--teal-700))" />
          <text x="0" y="-3.6" textAnchor="middle" fontSize="1.6" fill="hsl(var(--teal-700))" fontFamily="var(--font-mono)">N</text>
        </g>
        <g transform="translate(6, 54)">
          <line x1="0" y1="0" x2="14" y2="0" stroke="hsl(var(--teal-700))" strokeWidth="0.25" />
          <line x1="0" y1="-0.7" x2="0" y2="0.7" stroke="hsl(var(--teal-700))" strokeWidth="0.25" />
          <line x1="7" y1="-0.5" x2="7" y2="0.5" stroke="hsl(var(--teal-700))" strokeWidth="0.25" />
          <line x1="14" y1="-0.7" x2="14" y2="0.7" stroke="hsl(var(--teal-700))" strokeWidth="0.25" />
          <text x="0" y="-1.2" fontSize="1.4" fill="hsl(var(--teal-700))" fontFamily="var(--font-mono)" opacity="0.85">0</text>
          <text x="14" y="-1.2" textAnchor="end" fontSize="1.4" fill="hsl(var(--teal-700))" fontFamily="var(--font-mono)" opacity="0.85">200 mi</text>
        </g>
      </svg>

      {/* Floating "search" pill in the corner — the Google-Maps-simple promise */}
      <div className="absolute left-4 top-4 flex items-center gap-2 glass rounded-full px-3 py-1.5 text-xs text-foreground/80 shadow-atlas">
        <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
          <circle cx="5" cy="5" r="3" fill="none" stroke="currentColor" strokeWidth="1" />
          <line x1="7.2" y1="7.2" x2="10" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
        <span className="font-mono-num">2840 N Pleasant Ave, Dallas TX</span>
      </div>

      {/* Floating storm "card" — ATM-of-leads concept */}
      <div className="absolute bottom-4 right-4 glass rounded-lg p-3 text-xs shadow-atlas-lg">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide-caps text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-copper" />
          Live storm · 3h ago
        </div>
        <div className="font-medium text-foreground">Oklahoma City, OK</div>
        <div className="mt-1 flex items-center gap-3 font-mono-num text-foreground/80">
          <span>2.50&quot; max</span>
          <span className="text-muted-foreground">142 sq mi</span>
        </div>
      </div>
    </div>
  );
}
