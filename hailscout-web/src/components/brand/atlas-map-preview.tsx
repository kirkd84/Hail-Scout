"use client";

/**
 * Stylized product preview — the hero showpiece.
 *
 * Pure SVG + HTML overlays. No MapLibre, no tiles. Renders a dark map
 * plate that reads like the real product:
 *   - always-dark slate ground (the product map is dark in both themes)
 *   - faint lat/long graticule with mono coordinate labels
 *   - quiet contour + road furniture
 *   - a hail swath painted with the REAL data ramp via hailColor()
 *     (1.00″ → 1.50″ → 2.00″ nested bands, blurred like the smooth view)
 *   - a cyan crosshair pin — "hail size at this exact roof"
 *   - dark floating UI chips: search pill, size legend, roof readout
 *
 * HONESTY: this is an illustration, not live data — it is labeled
 * "Product preview · sample data" on the plate, the readout chip says
 * "sample", and nothing here claims to be live or sourced.
 *
 * The swath animates a draw-on once on mount (skipped for
 * prefers-reduced-motion) so the hero has one clear moment of motion.
 */
import { useEffect, useRef } from "react";
import { hailColor } from "@/lib/hail";
import { cn } from "@/lib/utils";

// Real ramp bins — data color used as data, never decoration.
const BIN_100 = hailColor(1.0); // Quarter — yellow
const BIN_150 = hailColor(1.5); // Walnut — orange
const BIN_200 = hailColor(2.0); // Hen egg — deep red

/** Always-light ink for the always-dark plate (cream-50 is mode-invariant white). */
const INK = "hsl(var(--cream-50))";
const CYAN = "hsl(var(--copper-500))";

/** Shared styling for the floating UI chips on the plate. */
const chip =
  "border border-cream-50/15 bg-teal-900/85 backdrop-blur-sm";

export function AtlasMapPreview({ className }: { className?: string }) {
  const swathRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    const g = swathRef.current;
    if (!g) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const paths = Array.from(g.querySelectorAll("path"));
    paths.forEach((p, i) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
      requestAnimationFrame(() => {
        p.style.transition = `stroke-dashoffset 1.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.12}s`;
        p.style.strokeDashoffset = "0";
      });
    });
  }, []);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-teal-900 shadow-panel",
        className,
      )}
    >
      <svg viewBox="0 0 100 62" className="block h-auto w-full">
        <defs>
          <pattern id="hgps-graticule" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke={INK} strokeWidth="0.06" opacity="0.1" />
          </pattern>
          <filter id="hgps-swath-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.7" />
          </filter>
          <radialGradient id="hgps-vignette" cx="50%" cy="42%" r="80%">
            <stop offset="55%" stopColor="hsl(222 47% 4%)" stopOpacity="0" />
            <stop offset="100%" stopColor="hsl(222 47% 4%)" stopOpacity="0.5" />
          </radialGradient>
        </defs>

        {/* Dark map ground + graticule */}
        <rect width="100" height="62" fill="hsl(var(--teal-900))" />
        <rect width="100" height="62" fill="url(#hgps-graticule)" />

        {/* Faint topographic contours */}
        {[10, 24, 38, 52].map((y) => (
          <path
            key={y}
            d={`M0,${y} Q25,${y - 6} 50,${y - 2} T100,${y - 8}`}
            fill="none"
            stroke={INK}
            strokeWidth="0.12"
            opacity="0.05"
          />
        ))}

        {/* Road furniture — two quiet corridors */}
        <g fill="none" stroke={INK}>
          <path d="M20,0 C30,14 38,30 40,62" strokeWidth="0.22" opacity="0.13" />
          <path d="M0,38 C20,36 44,34 66,32 C78,31 90,30 100,29" strokeWidth="0.22" opacity="0.13" />
        </g>

        {/* Major graticule lines + mono coordinate labels (map dressing) */}
        <g fontFamily="var(--font-mono)" fill={INK}>
          <line x1="26" y1="0" x2="26" y2="62" stroke={INK} strokeWidth="0.08" strokeDasharray="0.9 1.4" opacity="0.16" />
          <line x1="74" y1="0" x2="74" y2="62" stroke={INK} strokeWidth="0.08" strokeDasharray="0.9 1.4" opacity="0.16" />
          <line x1="0" y1="21" x2="100" y2="21" stroke={INK} strokeWidth="0.08" strokeDasharray="0.9 1.4" opacity="0.16" />
          <line x1="0" y1="45" x2="100" y2="45" stroke={INK} strokeWidth="0.08" strokeDasharray="0.9 1.4" opacity="0.16" />
          <text x="26.9" y="3" fontSize="1.6" opacity="0.4">98°W</text>
          <text x="74.9" y="3" fontSize="1.6" opacity="0.4">97°W</text>
          <text x="1" y="20.2" fontSize="1.6" opacity="0.4">36°N</text>
          <text x="1" y="44.2" fontSize="1.6" opacity="0.4">35°N</text>
        </g>

        {/* Hail swath — the REAL ramp, nested like the product's smooth view.
            Painted as rounded stroked bands SW → NE, blurred at the edges. */}
        <g ref={swathRef} filter="url(#hgps-swath-blur)" fill="none" strokeLinecap="round">
          <path d="M8,55 C26,48 42,40 58,30 C70,22 80,16 91,11" stroke={BIN_100.solid} strokeWidth="15" opacity="0.18" />
          <path d="M12,54 C30,47 45,39 60,29 C72,21 82,15 90,11.5" stroke={BIN_150.solid} strokeWidth="8.5" opacity="0.26" />
          <path d="M30,45 C44,38 55,31 70,22" stroke={BIN_200.solid} strokeWidth="4" opacity="0.42" />
        </g>

        {/* Edge vignette to seat the swath into the plate */}
        <rect width="100" height="62" fill="url(#hgps-vignette)" />

        {/* City reference marks */}
        <g fontFamily="var(--font-mono)" fill={INK}>
          <circle cx="47" cy="33" r="0.55" opacity="0.8" />
          <text x="45.6" y="33.6" fontSize="1.8" opacity="0.55" textAnchor="end" letterSpacing="0.15">OKLAHOMA CITY</text>
          <circle cx="50" cy="20" r="0.4" opacity="0.6" />
          <text x="51.4" y="20.6" fontSize="1.6" opacity="0.45" letterSpacing="0.15">EDMOND</text>
          <circle cx="53" cy="47" r="0.4" opacity="0.6" />
          <text x="54.4" y="47.6" fontSize="1.6" opacity="0.45" letterSpacing="0.15">NORMAN</text>
        </g>

        {/* Cyan crosshair pin — size-at-this-roof, sitting in the 2.00″ core */}
        <g stroke={CYAN} strokeWidth="0.3" opacity="0.95" fill="none">
          <circle cx="56" cy="31" r="2.2" />
          <line x1="56" y1="27.6" x2="56" y2="29.3" />
          <line x1="56" y1="32.7" x2="56" y2="34.4" />
          <line x1="52.6" y1="31" x2="54.3" y2="31" />
          <line x1="57.7" y1="31" x2="59.4" y2="31" />
        </g>
        <circle cx="56" cy="31" r="0.65" fill={CYAN} />
      </svg>

      {/* Search pill — the Google-Maps-simple promise (hidden on xs so the
          honesty tag never collides with it) */}
      <div
        className={`absolute left-4 top-4 hidden items-center gap-2 rounded-full px-3 py-1.5 text-[11px] text-cream-50/85 sm:flex ${chip}`}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
          <circle cx="5" cy="5" r="3" fill="none" stroke="currentColor" strokeWidth="1" />
          <line x1="7.2" y1="7.2" x2="10" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
        <span className="font-mono-num">1400 NW 63rd St, Oklahoma City</span>
      </div>

      {/* Honesty tag — this plate is an illustration, not live data */}
      <div
        className={`absolute right-3 top-3 rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-cream-50/60 sm:right-4 sm:top-4 ${chip}`}
      >
        Product preview · sample data
      </div>

      {/* Size legend — the real ramp, labeled with real bin thresholds */}
      <div
        className={`absolute bottom-3 left-3 hidden items-center gap-2.5 rounded-full px-3 py-1.5 font-mono-num text-[10px] text-cream-50/75 sm:bottom-4 sm:left-4 sm:flex ${chip}`}
      >
        {[BIN_100, BIN_150, BIN_200].map((b) => (
          <span key={b.short} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: b.solid }} />
            {b.short}
          </span>
        ))}
      </div>

      {/* Roof readout — what the crosshair pin is reporting (sample) */}
      <div
        className={`absolute bottom-3 right-3 rounded-xl p-3 text-xs sm:bottom-4 sm:right-4 ${chip}`}
      >
        <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-cream-50/60">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: CYAN }} />
          At this roof · sample
        </div>
        <div className="mt-1.5 font-medium text-cream-50">Oklahoma City, OK</div>
        <div className="mt-1 flex items-center gap-2 font-mono-num text-cream-50/85">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: BIN_200.solid }} />
            {BIN_200.short} hail
          </span>
          <span className="text-cream-50/55">{BIN_200.object}</span>
        </div>
      </div>
    </div>
  );
}
