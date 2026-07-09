"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { notFound } from "next/navigation";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { ContourBg } from "@/components/brand/contour-bg";
import { useStorms } from "@/hooks/useStorms";
import { hailColor } from "@/lib/hail";
import { nearestMetro, METROS } from "@/lib/metros";
import { timeAgo } from "@/lib/time-ago";

// US state code → name. Covers all 50 + DC; only the ones with metros
// in our lookup actually get any data.
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DC: "DC", DE: "Delaware", FL: "Florida",
  GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana",
  IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine",
  MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming",
};

/**
 * /storms/state/[code] — per-state storm catalog.
 *
 * Filters the live storms list by nearest-metro state, so users can
 * land here from a state name in marketing copy or SEO. The state
 * code is uppercased two-letter (TX, OK, KS, etc.) matching the
 * METROS lookup.
 *
 * Window: last 12 months. Filter client-side because the API doesn't
 * have a `state` field — it has centroid lat/lng, which we map to
 * state via the closest metro.
 */
export default function StateStormsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const stateCode = code.toUpperCase();
  const stateName = STATE_NAMES[stateCode];
  if (!stateName) notFound();

  const from = useMemo(() => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const to = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  // Tight bbox around the state's metros so we don't pull all of CONUS
  // just to throw away 95%.
  const stateBbox = useMemo<[number, number, number, number]>(() => {
    const metrosInState = METROS.filter((m) => m.state === stateCode);
    if (metrosInState.length === 0) return [-125, 24, -66, 50];
    const lats = metrosInState.map((m) => m.lat);
    const lngs = metrosInState.map((m) => m.lng);
    // Pad ~150mi each side so cells just over the border get included
    const PAD = 2.2; // degrees
    return [
      Math.min(...lngs) - PAD,
      Math.min(...lats) - PAD,
      Math.max(...lngs) + PAD,
      Math.max(...lats) + PAD,
    ];
  }, [stateCode]);

  const { storms, isLoading } = useStorms({
    bbox: stateBbox,
    from,
    to,
    limit: 200,
    fallbackToFixtures: true,
  });

  // Final filter: nearestMetro state matches our target. Catches cells
  // inside the bbox but actually closer to a neighboring state.
  const filtered = useMemo(() => {
    return storms.filter((s) => {
      const where = nearestMetro(s.centroid_lat, s.centroid_lng);
      return where?.metro.state === stateCode;
    });
  }, [storms, stateCode]);

  const peak = filtered.length
    ? Math.max(...filtered.map((s) => s.max_hail_size_in))
    : 0;
  const peakColor = peak > 0 ? hailColor(peak) : null;

  return (
    <main className="bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden bg-topo">
        <ContourBg className="opacity-90" density="sparse" />
        <div className="container relative pb-10 pt-16 md:pb-12 md:pt-20">
          <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper">
            <Link href="/storms" className="hover:text-copper-700">
              ← All storms
            </Link>{" "}
            · State catalog
          </p>
          <h1 className="mt-2 font-display text-balance text-5xl font-medium leading-[1.05] tracking-tight-display text-foreground md:text-6xl">
            {stateName} hail · past year
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Every MRMS- and NEXRAD-detected hail cell whose footprint
            sits inside {stateName} or its near border. Indexed in the
            past 12 months.
          </p>
          {filtered.length > 0 && peakColor && (
            <div className="mt-6 inline-flex items-baseline gap-4 rounded-lg border border-border bg-card px-5 py-3">
              <span className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">
                {filtered.length} cells · peak
              </span>
              <span className="font-display text-2xl font-medium text-foreground">
                {peak.toFixed(2)}″ {peakColor.object}
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="bg-background">
        <div className="container py-10">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="font-display text-2xl text-foreground">
                No cells indexed in {stateName} in the past year.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                The pipeline is still backfilling. Check back later.
              </p>
            </div>
          ) : (
            <ul className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/60">
              {filtered.map((s) => {
                const c = hailColor(s.max_hail_size_in);
                const where = nearestMetro(s.centroid_lat, s.centroid_lng);
                const heavy = s.max_hail_size_in >= 1.5;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/storm/${s.id}`}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
                    >
                      <span
                        className="inline-flex h-12 w-14 flex-col items-center justify-center rounded-md ring-1 ring-foreground/15 shadow-sm"
                        style={{ background: c.solid, color: heavy ? "#FAF7F1" : c.text }}
                      >
                        <span className="font-mono-num text-sm font-medium leading-none">
                          {s.max_hail_size_in.toFixed(2)}″
                        </span>
                        <span className="text-[8px] uppercase tracking-wide-caps font-mono leading-none mt-0.5 opacity-90">
                          {c.object}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-lg font-medium tracking-tight-display text-foreground truncate">
                          {where?.label ?? stateName}
                        </p>
                        <p className="mt-0.5 text-xs font-mono-num text-muted-foreground">
                          {new Date(s.start_time).toLocaleDateString(undefined, {
                            month: "short",
                            day: "2-digit",
                            year: "numeric",
                          })}{" "}
                          · {timeAgo(s.start_time)} · {s.source}
                        </p>
                      </div>
                      <span className="font-mono-num text-[11px] uppercase tracking-wide-caps text-foreground/40">
                        See record →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="container py-12 text-center md:py-16">
          <h2 className="font-display text-balance text-3xl font-medium tracking-tight-display md:text-4xl">
            Cover your {stateName} territory automatically.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            HailScout matches every saved address in your customer list
            against every cell. Pull the leads inside each footprint as
            a CSV in one click.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/request-access"
              className="inline-flex items-center gap-2 rounded-md bg-copper px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-copper-700"
            >
              Request access <span aria-hidden>→</span>
            </Link>
            <Link
              href="/storms"
              className="inline-flex items-center gap-2 rounded-md border border-primary-foreground/20 bg-transparent px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10"
            >
              All storms
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
