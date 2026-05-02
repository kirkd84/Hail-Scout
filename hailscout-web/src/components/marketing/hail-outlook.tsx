"use client";

/**
 * 7-day hail outlook strip — marketing landing widget.
 * Reinforces the "we see what's coming" positioning with a forward-looking
 * forecast strip. Fixture data (NWS/SPC-style risk levels) keyed by region.
 *
 * Renders cleanly on cream surface; uses copper for moderate/high risk.
 */

const REGIONS = [
  { name: "Tornado Alley",  short: "OK · TX · KS",  base: 4 },
  { name: "Front Range",    short: "CO · NE · WY",  base: 3 },
  { name: "Mid-South",      short: "AR · TN · MO",  base: 3 },
  { name: "Carolinas",      short: "NC · SC · VA",  base: 1 },
  { name: "Upper Midwest",  short: "MN · WI · IA",  base: 2 },
];

// Risk levels: 0=quiet, 1=watch, 2=marginal, 3=slight, 4=enhanced, 5=moderate
const RISK = [
  { label: "Quiet",     bg: "bg-foreground/5",    text: "text-foreground/55", border: "border-border" },
  { label: "Watch",     bg: "bg-teal-700/10",     text: "text-teal-900",      border: "border-teal-700/30" },
  { label: "Marginal",  bg: "bg-forest/10",       text: "text-forest",        border: "border-forest/30" },
  { label: "Slight",    bg: "bg-copper/10",       text: "text-copper",        border: "border-copper/30" },
  { label: "Enhanced",  bg: "bg-copper/25",       text: "text-copper",        border: "border-copper/50" },
  { label: "Moderate",  bg: "bg-copper",          text: "text-white",         border: "border-copper" },
];

// Deterministic but varied 5x7 grid using region.base + day.
function risk(regionIdx: number, dayIdx: number): number {
  const region = REGIONS[regionIdx];
  // sinusoidal mix so it looks organic
  const v =
    region.base +
    Math.round(2 * Math.sin((dayIdx + regionIdx * 0.7) * 1.1)) +
    Math.round(1.4 * Math.cos((dayIdx + regionIdx * 1.3) * 0.6));
  return Math.max(0, Math.min(5, v));
}

const DAY_LABELS = ["Today", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"];

export function HailOutlook() {
  return (
    <section className="bg-background border-y border-border" id="outlook">
      <div className="container max-w-6xl py-20">
        <div className="grid gap-12 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
              7-day outlook
            </p>
            <h2 className="mt-3 font-display text-4xl md:text-5xl font-medium tracking-tight-display text-foreground">
              What's coming next.
            </h2>
            <p className="mt-3 max-w-xl text-foreground/70 text-lg">
              Plan the week from the atlas. Convective outlook, MRMS, and
              regional risk mixed into one view your foreman can read at the
              breakfast table.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3 text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55">
            <span>Source:</span>
            <span className="text-foreground">NWS SPC + MRMS</span>
          </div>
        </div>

        {/* Grid */}
        <div className="mt-10 overflow-x-auto">
          <div className="min-w-[640px] rounded-xl border border-border bg-card overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[180px_repeat(7,1fr)] border-b border-border bg-secondary/40">
              <div className="px-5 py-3 font-mono text-[10px] uppercase tracking-wide-caps text-foreground/55">
                Region
              </div>
              {DAY_LABELS.map((d) => (
                <div
                  key={d}
                  className="px-3 py-3 text-center font-mono text-[10px] uppercase tracking-wide-caps text-foreground/55"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Region rows */}
            {REGIONS.map((r, ri) => (
              <div
                key={r.name}
                className="grid grid-cols-[180px_repeat(7,1fr)] border-b border-border/60 last:border-0"
              >
                <div className="px-5 py-4">
                  <p className="font-medium text-foreground">{r.name}</p>
                  <p className="font-mono-num text-[11px] text-foreground/55">
                    {r.short}
                  </p>
                </div>
                {DAY_LABELS.map((_, di) => {
                  const v = risk(ri, di);
                  const tone = RISK[v];
                  return (
                    <div key={di} className="p-2 flex items-center justify-center">
                      <div
                        className={`w-full rounded-md border px-2 py-2 text-center ${tone.bg} ${tone.border}`}
                        title={`${tone.label} risk`}
                      >
                        <span
                          className={`font-mono text-[10px] uppercase tracking-wide-caps ${tone.text}`}
                        >
                          {tone.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-wide-caps text-foreground/55">
            Legend:
          </span>
          {RISK.map((r) => (
            <span
              key={r.label}
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wide-caps ${r.bg} ${r.text} ${r.border}`}
            >
              {r.label}
            </span>
          ))}
        </div>

        <p className="mt-6 text-sm text-foreground/55 max-w-2xl">
          The outlook is a five-day SPC blend updated every 4 hours. We layer it
          with MRMS hail observations from the past 24 hours so you can compare
          forecast risk against actual hits.
        </p>
      </div>
    </section>
  );
}
