"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { StatTicker } from "@/components/marketing/stat-ticker";
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
  const { data, isLoading, error } = useStormsAtAddress(submitted);
  const accuracy = useAccuracyStat();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
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
        <div className="container relative pb-12 pt-16 md:pb-16 md:pt-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper">
              Claim lookup · public
            </p>
            <h1 className="mt-3 font-display text-balance text-5xl font-medium leading-[1.05] tracking-tight-display text-foreground md:text-6xl">
              Was your home hit by hail?
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Search any U.S. address. We&apos;ll tell you exactly what hail size
              fell there — cross-checked against NOAA MRMS, NEXRAD dual-pol
              radar, and National Weather Service ground reports.
            </p>
            {accuracy?.headline && (
              <p className="mx-auto mt-4 max-w-xl rounded-full border border-forest/30 bg-forest/5 px-4 py-2 text-sm text-forest">
                {accuracy.headline}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-xl">
            <div className="glass flex items-center gap-3 rounded-full px-5 py-3 shadow-panel">
              <IconSearch className="h-4 w-4 text-foreground/55" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="2840 N Pleasant Ave, Dallas TX"
                className="flex-1 bg-transparent text-base text-foreground placeholder:text-foreground/45 outline-none"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-teal-900 disabled:opacity-60"
              >
                {isLoading ? "Looking…" : "Look up"}
              </button>
            </div>
          </form>

          {error && (
            <p className="mx-auto mt-3 max-w-xl text-center text-sm text-destructive">
              {error.message}
            </p>
          )}
        </div>
      </section>

      {data && (
        <section className="bg-card border-y border-border">
          <div className="container py-12 md:py-16 max-w-3xl">
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
              Result
            </p>
            <h2 className="mt-1 font-display text-3xl font-medium tracking-tight-display text-foreground md:text-4xl">
              {data.address}
            </h2>
            <p className="mt-1 text-xs font-mono-num text-foreground/55">
              {data.lat.toFixed(4)}°N, {Math.abs(data.lng).toFixed(4)}°W
            </p>

            <div className="rule-atlas my-8" />

            {data.storms.length === 0 ? (
              <div className="rounded-xl border border-border bg-background p-6 text-center">
                <p className="font-display text-2xl font-medium tracking-tight-display text-foreground">
                  No hail on record at this address.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  In our indexed window, no MRMS- or NEXRAD-detected hail
                  events touched this exact point. Try a nearby address or
                  widen your time window.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-copper/40 bg-copper/5 p-5 mb-8">
                  <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper-700">
                    Summary
                  </p>
                  <p className="mt-2 font-display text-2xl font-medium tracking-tight-display text-foreground">
                    {data.storms.length} hail event
                    {data.storms.length === 1 ? "" : "s"} on record at this address.
                  </p>
                  <p className="mt-2 text-sm text-foreground/85">
                    Peak hail size:{" "}
                    <span className="font-medium text-copper-700">
                      {Math.max(...data.storms.map((s) => s.max_hail_size_in)).toFixed(2)}″
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

            <div className="rounded-md border border-border bg-secondary/30 p-5 mt-10">
              <p className="text-sm text-foreground/85 leading-relaxed">
                <strong className="font-medium">Next steps:</strong> share this
                page with your roofer or insurance adjuster — they&apos;ll know
                exactly what to verify on-site. The storm IDs and dates are
                citable from NOAA&apos;s MRMS / NEXRAD feeds.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      const url = `${window.location.origin}/claim?address=${encodeURIComponent(data.address)}`;
                      void navigator.clipboard?.writeText(url);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground hover:border-copper/50"
                >
                  Copy share link
                </button>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-teal-900"
                >
                  I&apos;m a contractor — start free trial <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {!data && !isLoading && (
        <section className="bg-card border-y border-border">
          <div className="container py-14 max-w-3xl">
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper text-center">
              Try one of these
            </p>
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
                      setQuery(m);
                      setSubmitted(m);
                    }}
                    className="rounded-lg border border-border bg-background p-4 text-left transition-colors hover:border-copper/50"
                  >
                    <p className="font-medium text-foreground">{m}</p>
                    {metro && (
                      <p className="mt-1 text-xs text-muted-foreground font-mono-num">
                        {metro.lat.toFixed(2)}°N, {Math.abs(metro.lng).toFixed(2)}°W
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <FinalCta />
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
    <div className="mb-6 rounded-xl border border-border bg-background p-5">
      <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
        Area exposure
      </p>
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
      <p className="font-display text-lg font-medium tracking-tight-display text-foreground">
        {value}
      </p>
      <p className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55">
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
    <li className="rounded-xl border border-border bg-background p-5 flex items-start gap-4">
      <span
        className="inline-flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-md ring-1 ring-foreground/15 shadow-sm"
        style={{ background: c.solid, color: badgeText }}
      >
        <span className="font-mono-num text-base font-medium leading-none">
          {peak.toFixed(2)}″
        </span>
        <span className="text-[9px] uppercase tracking-wide-caps font-mono leading-none mt-1 opacity-90">
          {c.object}
        </span>
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-lg font-medium tracking-tight-display text-foreground">
            {new Date(storm.start_time).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <VerificationBadge verification={storm.verification} />
        </div>
        <p className="mt-1 text-xs font-mono-num text-foreground/55">
          {timeAgo(storm.start_time)} · {storm.source} · id {storm.id.slice(-8)}
        </p>
        {/* Prefer the verification headline (tier-aware, honest) over the
            old size-only blurb when verification is present. */}
        <p className="mt-2 text-sm text-foreground/85 leading-relaxed">
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
              This storm peaked at {storm.storm_peak_size_in.toFixed(2)}″ elsewhere
              in its path — {peak.toFixed(2)}″ is the size at this address.
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
              className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wide-caps text-foreground/60 hover:text-foreground"
            >
              {showEvidence ? "Hide evidence" : "Why we're confident"}
              <span aria-hidden>{showEvidence ? "↑" : "↓"}</span>
            </button>
          )}
          <DownloadReportButton storm={storm} address={address} compact />
          <Link
            href={`/storm/${storm.id}`}
            className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wide-caps text-copper hover:text-copper-700"
          >
            Full record <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </li>
  );
}

function FinalCta() {
  return (
    <section className="border-t border-border bg-primary text-primary-foreground">
      <div className="container py-16 text-center md:py-20">
        <h2 className="font-display text-balance text-3xl font-medium tracking-tight-display md:text-4xl">
          Are you a roofing contractor?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
          HailScout pulls every storm in the U.S. hail belt onto one atlas. Save customer addresses, get alerted instantly, generate branded Hail Impact Reports.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-md bg-copper px-5 py-3 text-sm font-medium text-primary-foreground shadow-atlas-lg hover:bg-copper-700">
            Start your free trial <span aria-hidden>→</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-md border border-primary-foreground/20 bg-transparent px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10">
            How HailScout works
          </Link>
        </div>
      </div>
    </section>
  );
}
