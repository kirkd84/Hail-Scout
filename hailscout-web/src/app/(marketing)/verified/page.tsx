"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { ContourBg } from "@/components/brand/contour-bg";
import { useStormsAtAddress } from "@/hooks/useStormsAtAddress";
import { hailColor } from "@/lib/hail";
import { VerificationBadge } from "@/components/verification-badge";

/**
 * Verified hit — a clean, shareable homeowner-facing page. A contractor (or
 * the public claim tool) shares a link like
 *   /verified?lat=..&lng=..&label=123+Main+St&brand=Acme+Roofing
 * and the recipient sees a trust-first "your property was struck by X" hail"
 * summary, verified against NOAA/NWS data. Stateless — the link encodes the
 * location; the data is fetched live so it's always current.
 */
export default function VerifiedPage() {
  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <Suspense fallback={<div className="container py-24 text-center text-muted-foreground">Loading…</div>}>
        <VerifiedView />
      </Suspense>
      <SiteFooter />
    </main>
  );
}

function VerifiedView() {
  const params = useSearchParams();
  const latRaw = params.get("lat");
  const lngRaw = params.get("lng");
  const label = params.get("label") ?? undefined;
  const brand = params.get("brand") || "HailScout";
  const lat = latRaw ? Number(latRaw) : undefined;
  const lng = lngRaw ? Number(lngRaw) : undefined;
  const haveCoords = lat != null && !Number.isNaN(lat) && lng != null && !Number.isNaN(lng);

  const { data, isLoading } = useStormsAtAddress(
    label,
    haveCoords ? { lat: lat as number, lng: lng as number } : undefined,
  );

  if (!haveCoords) {
    return (
      <section className="container py-24 text-center max-w-xl">
        <h1 className="font-display text-3xl font-medium tracking-tight-display text-foreground">
          Verify a property
        </h1>
        <p className="mt-3 text-muted-foreground">
          This page needs a location. Look up any address to generate a verified
          report you can share.
        </p>
        <Link href="/claim" className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-teal-900">
          Look up an address <span aria-hidden>→</span>
        </Link>
      </section>
    );
  }

  const storms = data?.storms ?? [];
  const peak = storms.length ? Math.max(...storms.map((s) => s.max_hail_size_in)) : 0;
  const hit = storms.length > 0 && peak > 0;
  const c = hailColor(peak);
  const confirmed = storms.some((s) => s.verification?.tier === "ground_truth_confirmed");

  return (
    <>
      <section className="relative overflow-hidden bg-topo">
        <ContourBg className="opacity-90" density="sparse" />
        <div className="container relative pb-10 pt-14 md:pt-20 text-center">
          <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper">
            {brand} · storm verification
          </p>
          <h1 className="mx-auto mt-3 max-w-3xl font-display text-balance text-4xl font-medium leading-[1.08] tracking-tight-display text-foreground md:text-5xl">
            {label ?? "This property"}
          </h1>
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="container py-12 md:py-16 max-w-2xl">
          {isLoading ? (
            <p className="text-center text-muted-foreground">Checking NOAA &amp; NWS records…</p>
          ) : hit ? (
            <div className="text-center">
              <div
                className="mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-mono uppercase tracking-wide-caps"
                style={{ background: confirmed ? "#2F7A4F1A" : "#0F4C5C14", color: confirmed ? "#2F7A4F" : "#0F4C5C" }}
              >
                {confirmed ? "✓ Ground-truth confirmed" : "✓ Radar verified"}
              </div>
              <p className="mt-6 text-sm uppercase tracking-wide-caps text-muted-foreground">
                Largest hail on record here
              </p>
              <p className="font-display text-7xl font-medium tracking-tight-display" style={{ color: c.solid }}>
                {peak.toFixed(2)}″
              </p>
              <p className="mt-1 text-lg font-medium text-foreground">{c.object}</p>
              <p className="mx-auto mt-4 max-w-md text-muted-foreground">
                {storms.length} hail event{storms.length === 1 ? "" : "s"} on record
                at this location, cross-checked against NOAA MRMS, NEXRAD dual-pol
                radar, and National Weather Service ground reports.
              </p>

              <ul className="mt-8 space-y-2 text-left">
                {storms
                  .slice()
                  .sort((a, b) => b.max_hail_size_in - a.max_hail_size_in)
                  .slice(0, 6)
                  .map((s) => {
                    const sc = hailColor(s.max_hail_size_in);
                    return (
                      <li key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
                        <span
                          className="inline-flex h-10 w-12 shrink-0 items-center justify-center rounded-md font-mono-num text-xs font-medium ring-1 ring-foreground/15"
                          style={{ background: sc.solid, color: s.max_hail_size_in >= 1.5 ? "#FAF7F1" : sc.text }}
                        >
                          {s.max_hail_size_in.toFixed(2)}″
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {new Date(s.start_time).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {s.verification?.headline ?? `${s.max_hail_size_in.toFixed(2)}″ hail at this point`}
                          </p>
                        </div>
                        <VerificationBadge verification={s.verification} />
                      </li>
                    );
                  })}
              </ul>
            </div>
          ) : (
            <div className="text-center">
              <p className="font-display text-3xl font-medium tracking-tight-display text-foreground">
                No hail on record at this location.
              </p>
              <p className="mt-3 text-muted-foreground">
                In our indexed window, no verified hail events touched this exact
                point.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="container py-14 text-center md:py-16">
          <h2 className="font-display text-balance text-2xl font-medium tracking-tight-display md:text-3xl">
            {hit ? "Worth a free roof inspection." : "Check another address."}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-primary-foreground/80">
            {hit
              ? `Hail this size routinely damages roofing. ${brand} can document it for your insurance claim.`
              : "Search any U.S. address to see its verified hail history."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/claim" className="inline-flex items-center gap-2 rounded-md bg-copper px-5 py-3 text-sm font-medium text-primary-foreground shadow-atlas-lg hover:bg-copper-700">
              Look up an address <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
