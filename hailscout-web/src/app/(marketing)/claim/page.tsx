"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { StatTicker } from "@/components/marketing/stat-ticker";
import { CtaBand } from "@/components/marketing/primitives";
import { ContourBg } from "@/components/brand/contour-bg";
import { useStormsAtAddress } from "@/hooks/useStormsAtAddress";
import { hailColor } from "@/lib/hail";
import { timeAgo } from "@/lib/time-ago";
import { IconSearch } from "@/components/icons";
import { METROS } from "@/lib/metros";
import type { Storm } from "@/lib/api-types";
import { VerificationBadge, VerificationPanel } from "@/components/verification-badge";
import { DownloadReportButton } from "@/components/reports/download-report-button";
import { useAccuracyStat } from "@/hooks/useAccuracyStat";
import { useExposure } from "@/hooks/useExposure";
import { useGeolocation } from "@/hooks/useGeolocation";

/**
 * Public claim lookup — homeowners and insurance adjusters can search
 * any address and see if it's been hit by hail. No auth required.
 *
 * Phase 16.8 migration: data sourced from /v1/storms/at-point via the
 * useStormsAtAddress hook (which geocodes the address and queries the
 * live API). Hook keeps the fixture polygon hit-test as a fallback so
 * the page works even if the API is empty.
 */
export default function ClaimLookupPage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | undefined>(undefined);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const { data, isLoading, error } = useStormsAtAddress(submitted, coords ?? undefined);
  const accuracy = useAccuracyStat();
  const geo = useGeolocation();

  // When the device returns a GPS fix, run the lookup at those coordinates.
  useEffect(() => {
    if (geo.coords) {
      setCoords(geo.coords);
      setSubmitted("My current location");
      setQuery("");
    }
  }, [geo.coords]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setCoords(null);
    setSubmitted(query.trim());
  };

  // Pick a small handful of well-known hail-belt metros as "try one of
  // these" prompts so a fresh visitor can see results immediately.
  const sampleMetros = [
    "Dallas, TX",
    "Amarillo, TX",
    "Oklahoma City, OK",
    "Wichita, KS",
    "Denver, CO",
    "Omaha, NE",
  ];

  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <StatTicker />

      {/* Hero + search */}
      <section className="relative overflow-hidden bg-topo">
        <ContourBg className="opacity-90" density="sparse" />
        <div className="container relative max-w-6xl pb-14 pt-16 md:pb-20 md:pt-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Claim lookup · Public</p>
            <h1 className="display-1 mt-3 text-foreground">
              Was your home hit by hail?
            </h1>
            <p className="mx-auto mt-5 max-w-prose text-base leading-[1.65] text-muted-foreground text-pretty">
              Search any U.S. address and see the hail that fell there — how
              big, when, and how confident we are. Every result is checked
              against NOAA radar and National Weather Service ground reports.
            </p>
            {accuracy?.headline && (
              <Link
                href="/accuracy"
                className="mx-auto mt-5 inline-flex min-h-11 max-w-xl items-center justify-center gap-1.5 rounded-md border border-border bg-card px-4 text-sm text-foreground/85 transition-colors hover:border-copper/50"
              >
                {accuracy.headline}{" "}
                <span aria-hidden className="text-copper">
                  &rarr;
                </span>
              </Link>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-xl">
            <label htmlFor="claim-address" className="sr-only">
              Street address
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/55" />
                <input
                  id="claim-address"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="2840 N Pleasant Ave, Dallas TX"
                  className="min-h-11 w-full rounded-md border border-border bg-card pl-10 pr-3 text-base text-foreground shadow-panel outline-none placeholder:text-foreground/45 focus:border-copper"
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-copper-700 disabled:opacity-60"
              >
                {isLoading ? "Looking…" : "Look up"}
              </button>
            </div>
          </form>

          <div className="mx-auto mt-2 flex max-w-xl justify-center">
            <button
              type="button"
              onClick={geo.locate}
              disabled={geo.loading || isLoading}
              className="inline-flex min-h-11 items-center gap-1.5 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            >
              <LocateIcon className="h-4 w-4" />
              {geo.loading ? "Locating…" : "Use my current location"}
            </button>
          </div>

          {(error || geo.error) && (
            <p className="mx-auto mt-3 max-w-xl text-center text-sm text-destructive">
              {geo.error ?? error?.message}
            </p>
          )}
        </div>
      </section>

      {data && (
        <section className="border-y border-border bg-secondary/40">
          <div className="container max-w-3xl py-12 md:py-16">
            <p className="eyebrow">Result</p>
            <h2 className="display-2 mt-2 text-foreground">{data.address}</h2>
            <p className="mt-2 font-mono-num text-xs text-foreground/55">
              {data.lat.toFixed(4)}&deg;N, {Math.abs(data.lng).toFixed(4)}&deg;W
            </p>

            <div className="rule-atlas my-8" />

            {data.storms.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-2xl font-semibold tracking-[-0.01em] text-foreground text-balance">
                  No hail on record at this address.
                </p>
                <p className="mx-auto mt-2 max-w-prose text-sm text-muted-foreground">
                  We checked our full storm record and found no hail at this
                  exact point. Hail can be very localized — try a nearby
                  address if you think a storm came close.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-8 rounded-xl border border-copper/40 bg-copper/5 p-6">
                  <p className="eyebrow">Summary</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-foreground text-balance">
                    {data.storms.length} hail event
                    {data.storms.length === 1 ? "" : "s"} on record at this address.
                  </p>
                  <p className="mt-2 text-sm text-foreground/85">
                    Biggest hail:{" "}
                    <span className="font-mono-num font-medium text-copper-700">
                      {Math.max(...data.storms.map((s) => s.max_hail_size_in)).toFixed(2)}&Prime;
                    </span>{" "}
                    ({hailColor(Math.max(...data.storms.map((s) => s.max_hail_size_in))).object}).
                    {Math.max(...data.storms.map((s) => s.max_hail_size_in)) >= 1.0 &&
                      " This is well within the threshold for filing a hail-damage insurance claim."}
                  </p>
                </div>

                <ExposurePanel lat={data.lat} lng={data.lng} />

                <ul className="space-y-3">
                  {data.storms
                    .slice()
                    .sort((a, b) => b.max_hail_size_in - a.max_hail_size_in)
                    .map((s) => (
                      <StormResultCard key={s.id} storm={s} address={data.address} />
                    ))}
                </ul>
              </>
            )}

            <div className="mt-10 rounded-xl border border-border bg-card p-6">
              <p className="text-sm leading-relaxed text-foreground/85">
                <strong className="font-medium">Next steps:</strong> share this
                page with your roofer or insurance adjuster — they&apos;ll know
                exactly what to verify on-site. Every storm here has an ID and
                date that trace back to NOAA&apos;s public weather records.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      const url = `${window.location.origin}/verified?lat=${data.lat}&lng=${data.lng}&label=${encodeURIComponent(data.address)}`;
                      void navigator.clipboard?.writeText(url);
                    }
                  }}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-secondary/60"
                >
                  Copy verified link
                </button>
                <Link
                  href="/request-access"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-copper-700"
                >
                  I&apos;m a contractor — request access <span aria-hidden>&rarr;</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {!data && !isLoading && (
        <section className="border-y border-border bg-secondary/40">
          <div className="container max-w-3xl py-14">
            <p className="eyebrow text-center">Try one of these</p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {sampleMetros.map((m) => {
                const metro = METROS.find(
                  (x) => `${x.name}, ${x.state}` === m,
                );
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setCoords(null);
                      setQuery(m);
                      setSubmitted(m);
                    }}
                    className="min-h-11 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-copper/50"
                  >
                    <p className="font-medium text-foreground">{m}</p>
                    {metro && (
                      <p className="mt-1 font-mono-num text-xs text-muted-foreground">
                        {metro.lat.toFixed(2)}&deg;N, {Math.abs(metro.lng).toFixed(2)}&deg;W
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <CtaBand
        title="Roofing contractor? Put every storm on one map."
        lede="Hail GPS tracks hail across the U.S., alerts your team the moment a saved address gets hit, and generates branded hail reports your customers can trust."
        primary={{ label: "Request access", href: "/request-access" }}
        secondary={{ label: "How Hail GPS works", href: "/" }}
      />
      <SiteFooter />
    </main>
  );
}

function ExposurePanel({ lat, lng }: { lat: number; lng: number }) {
  const exposure = useExposure(lat, lng);
  // Hide entirely until we have at least an area name.
  if (!exposure?.available || !exposure.area_name) return null;

  const fmtMoney = (n: number | null) =>
    n == null ? "—" : `$${Math.round(n).toLocaleString()}`;
  const fmtNum = (n: number | null) =>
    n == null ? "—" : Math.round(n).toLocaleString();
  const hasDemo =
    exposure.population != null ||
    exposure.housing_units != null ||
    exposure.median_home_value != null;

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-6">
      <p className="eyebrow">Area exposure</p>
      <p className="mt-1 text-sm text-foreground/85">
        {exposure.area_name}
      </p>
      {hasDemo ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Households" value={fmtNum(exposure.housing_units)} />
          <Stat label="Population" value={fmtNum(exposure.population)} />
          <Stat label="Median home" value={fmtMoney(exposure.median_home_value)} />
          <Stat label="Median income" value={fmtMoney(exposure.median_household_income)} />
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {exposure.note ?? "Demographics unavailable for this area."}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono-num text-lg font-medium text-foreground">
        {value}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-wide-caps text-foreground/55">
        {label}
      </p>
    </div>
  );
}

function StormResultCard({ storm, address }: { storm: Storm; address?: string }) {
  const c = hailColor(storm.max_hail_size_in);
  const heavy = storm.max_hail_size_in >= 1.5;
  const badgeText = heavy ? "#FAF7F1" : c.text;
  const peak = storm.max_hail_size_in;
  const [showEvidence, setShowEvidence] = useState(false);
  return (
    <li className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
      <span
        className="inline-flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-md shadow-sm ring-1 ring-foreground/15"
        style={{ background: c.solid, color: badgeText }}
      >
        <span className="font-mono-num text-base font-medium leading-none">
          {peak.toFixed(2)}&Prime;
        </span>
        <span className="mt-1 font-mono text-[9px] uppercase leading-none tracking-wide-caps opacity-90">
          {c.object}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-semibold tracking-[-0.01em] text-foreground">
            {new Date(storm.start_time).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <VerificationBadge verification={storm.verification} />
        </div>
        <p className="mt-1 font-mono-num text-xs text-foreground/55">
          {timeAgo(storm.start_time)} · {storm.source} · id {storm.id.slice(-8)}
        </p>
        {/* Prefer the verification headline (tier-aware, honest) over the
            old size-only blurb when verification is present. */}
        <p className="mt-2 text-sm leading-relaxed text-foreground/85">
          {storm.verification
            ? storm.verification.headline
            : peak >= 2.0
              ? `Damaging ${c.object.toLowerCase()}-size hail (${peak.toFixed(2)}″) at this point.`
              : peak >= 1.0
                ? `${peak.toFixed(2)}″ hail at this point — claim-eligible damage likely on standard roofing materials.`
                : `${peak.toFixed(2)}″ hail at this point. Minor surface impact possible.`}
        </p>

        {/* Transparency: if the storm peaked larger elsewhere, say so —
            but the headline number is what fell at THIS address. */}
        {typeof storm.storm_peak_size_in === "number" &&
          storm.storm_peak_size_in > peak + 0.2 && (
            <p className="mt-1 text-xs text-foreground/55">
              This storm peaked at {storm.storm_peak_size_in.toFixed(2)}&Prime; elsewhere
              in its path — {peak.toFixed(2)}&Prime; is the size at this address.
            </p>
          )}

        {storm.verification && showEvidence && (
          <VerificationPanel verification={storm.verification} className="mt-3" />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {storm.verification && (
            <button
              type="button"
              onClick={() => setShowEvidence((v) => !v)}
              className="inline-flex min-h-11 items-center gap-1 font-mono text-xs uppercase tracking-wide-caps text-foreground/60 hover:text-foreground"
            >
              {showEvidence ? "Hide evidence" : "Why we're confident"}
              <span aria-hidden>{showEvidence ? "↑" : "↓"}</span>
            </button>
          )}
          <DownloadReportButton storm={storm} address={address} compact />
          <Link
            href={`/storm/${storm.id}`}
            className="inline-flex min-h-11 items-center gap-1 font-mono text-xs uppercase tracking-wide-caps text-copper hover:text-copper-700"
          >
            Full record <span aria-hidden>&rarr;</span>
          </Link>
        </div>
      </div>
    </li>
  );
}

function LocateIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2v3.2M12 18.8V22M2 12h3.2M18.8 12H22" />
    </svg>
  );
}
