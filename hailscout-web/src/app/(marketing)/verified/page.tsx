"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { ContourBg } from "@/components/brand/contour-bg";
import { CtaBand } from "@/components/marketing/primitives";
import { useStormsAtAddress } from "@/hooks/useStormsAtAddress";
import { hailColor } from "@/lib/hail";
import { cn } from "@/lib/utils";
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
      <Suspense
        fallback={
          <div className="container py-24 text-center font-mono text-sm uppercase tracking-wide-caps text-muted-foreground">
            Loading…
          </div>
        }
      >
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
  const brand = params.get("brand") || "Hail GPS";
  const lat = latRaw ? Number(latRaw) : undefined;
  const lng = lngRaw ? Number(lngRaw) : undefined;
  const haveCoords = lat != null && !Number.isNaN(lat) && lng != null && !Number.isNaN(lng);

  const { data, isLoading } = useStormsAtAddress(
    label,
    haveCoords ? { lat: lat as number, lng: lng as number } : undefined,
  );

  if (!haveCoords) {
    return (
      <section className="container max-w-xl py-24 text-center">
        <h1 className="display-2 text-foreground">Verify a property</h1>
        <p className="mt-4 max-w-prose text-muted-foreground">
          This page needs a location. Look up any address to generate a verified
          report you can share.
        </p>
        <Link
          href="/claim"
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-copper-700"
        >
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
      <section className="relative overflow-hidden">
        <ContourBg className="opacity-80" density="sparse" />
        <div className="container relative max-w-6xl pb-10 pt-14 text-center md:pt-20">
          <p className="eyebrow">{brand} · storm verification</p>
          {haveCoords && (
            <p className="mt-2 font-mono-num text-[11px] tabular-nums text-foreground/45">
              {(lat as number).toFixed(4)}°N {Math.abs(lng as number).toFixed(4)}°W
            </p>
          )}
          <h1 className="display-1 mx-auto mt-3 max-w-3xl text-foreground">
            {label ?? "This property"}
          </h1>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40">
        <div className="container max-w-2xl py-12 md:py-16">
          {isLoading ? (
            <p className="text-center font-mono text-sm uppercase tracking-wide-caps text-muted-foreground">
              Checking NOAA &amp; NWS records…
            </p>
          ) : hit ? (
            <div className="text-center">
              <div
                className={cn(
                  "mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-wide-caps ring-1",
                  confirmed
                    ? "bg-forest/10 text-forest ring-forest/30"
                    : "bg-primary/10 text-primary ring-primary/30",
                )}
              >
                {confirmed ? "✓ Ground-truth confirmed" : "✓ Radar verified"}
              </div>
              <p className="mt-6 font-mono text-[11px] uppercase tracking-wide-caps text-muted-foreground">
                Largest hail on record here
              </p>
              <p
                className="font-mono-num text-6xl font-medium tabular-nums md:text-7xl"
                style={{ color: c.solid }}
              >
                {peak.toFixed(2)}″
              </p>
              <p className="mt-1 text-lg font-medium text-foreground">{c.object}</p>
              <p className="mx-auto mt-4 max-w-md leading-[1.65] text-muted-foreground">
                {storms.length} hail event{storms.length === 1 ? "" : "s"} on record
                at this location, cross-checked against NOAA radar and National
                Weather Service ground reports.
              </p>

              <ul className="mt-8 space-y-2 text-left">
                {storms
                  .slice()
                  .sort((a, b) => b.max_hail_size_in - a.max_hail_size_in)
                  .slice(0, 6)
                  .map((s) => {
                    const sc = hailColor(s.max_hail_size_in);
                    return (
                      <li
                        key={s.id}
                        className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-secondary/40"
                      >
                        <span
                          className="inline-flex h-10 w-12 shrink-0 items-center justify-center rounded-md font-mono-num text-xs font-medium tabular-nums ring-1 ring-foreground/15"
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
              <p className="font-mono text-[11px] uppercase tracking-wide-caps text-foreground/45">
                All clear
              </p>
              <p className="display-2 mt-3 text-foreground">
                No hail on record at this location.
              </p>
              <p className="mx-auto mt-3 max-w-prose text-muted-foreground">
                In our indexed window, no verified hail events touched this exact
                point.
              </p>
            </div>
          )}
        </div>
      </section>

      <CtaBand
        title={hit ? "Worth a roof inspection." : "Check another address."}
        lede={
          hit
            ? `Hail this size routinely damages roofing. ${brand} can document it for your insurance claim.`
            : "Search any U.S. address to see its verified hail history."
        }
        primary={{ label: "Look up an address", href: "/claim" }}
      />
    </>
  );
}
