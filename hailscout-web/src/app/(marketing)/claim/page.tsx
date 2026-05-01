"use client";

import { useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { StatTicker } from "@/components/marketing/stat-ticker";
import { ContourBg } from "@/components/brand/contour-bg";
import { searchAddress } from "@/lib/geocode";
import { fixturesAtPoint, STORM_FIXTURES, type StormFixture } from "@/lib/storm-fixtures";
import { hailColor } from "@/lib/hail";
import { synthesize } from "@/lib/storm-narrative";
import { timeAgo } from "@/lib/time-ago";
import { IconSearch } from "@/components/icons";

interface ResultState {
  address: string;
  lat: number;
  lng: number;
  storms: StormFixture[];
}

/**
 * Public claim lookup — homeowners and insurance adjusters can search
 * any address and see if it's been hit by hail. No auth required.
 */
export default function ClaimLookupPage() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await searchAddress(query.trim());
      if (!r) {
        setError("Could not find that address. Try a city + state, like 'Dallas TX'.");
        return;
      }
      const storms = fixturesAtPoint(r.lng, r.lat);
      setResult({ address: r.pretty, lat: r.lat, lng: r.lng, storms });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  };

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
              fell there — pulled from the same NOAA MRMS data your insurance
              carrier and roofing contractor use.
            </p>
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
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !query.trim()}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-teal-900 disabled:opacity-60"
              >
                {busy ? "Looking…" : "Look up"}
              </button>
            </div>
          </form>

          {error && (
            <p className="mx-auto mt-3 max-w-xl text-center text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </section>

      {result && (
        <section className="bg-card border-y border-border">
          <div className="container py-12 md:py-16 max-w-3xl">
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
              Result
            </p>
            <h2 className="mt-1 font-display text-3xl font-medium tracking-tight-display text-foreground md:text-4xl">
              {result.address}
            </h2>
            <p className="mt-1 text-xs font-mono-num text-foreground/55">
              {result.lat.toFixed(4)}°N, {Math.abs(result.lng).toFixed(4)}°W
            </p>

            <div className="rule-atlas my-8" />

            {result.storms.length === 0 ? (
              <div className="rounded-xl border border-border bg-background p-6 text-center">
                <p className="font-display text-2xl font-medium tracking-tight-display text-foreground">
                  No hail on record at this address.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Within the last 30 days, no MRMS-detected hail events have
                  touched this point.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-copper/40 bg-copper/5 p-5 mb-8">
                  <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper-700">
                    Summary
                  </p>
                  <p className="mt-2 font-display text-2xl font-medium tracking-tight-display text-foreground">
                    {result.storms.length} hail event{result.storms.length === 1 ? "" : "s"} on record at this address.
                  </p>
                  <p className="mt-2 text-sm text-foreground/85">
                    Peak hail size:{" "}
                    <span className="font-medium text-copper-700">
                      {Math.max(...result.storms.map((s) => s.max_hail_size_in)).toFixed(2)}″
                    </span>{" "}
                    ({hailColor(Math.max(...result.storms.map((s) => s.max_hail_size_in))).object}).
                    This is well within the threshold for filing a hail-damage
                    insurance claim.
                  </p>
                </div>

                <ul className="space-y-3">
                  {result.storms
                    .sort((a, b) => b.max_hail_size_in - a.max_hail_size_in)
                    .map((s) => (
                      <StormResultCard key={s.id} storm={s} />
                    ))}
                </ul>
              </>
            )}

            <div className="rounded-md border border-border bg-secondary/30 p-5 mt-10">
              <p className="text-sm text-foreground/85 leading-relaxed">
                <strong className="font-medium">Next steps:</strong> share this
                page with your roofer or insurance adjuster — they&apos;ll know
                exactly what to verify on-site. The storm IDs and dates are
                citable from NOAA&apos;s MRMS feed.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      const url = `${window.location.origin}/claim?address=${encodeURIComponent(result.address)}`;
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

      {!result && (
        <section className="bg-card border-y border-border">
          <div className="container py-14 max-w-3xl">
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper text-center">
              Try one of these
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {STORM_FIXTURES.slice(0, 6).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setQuery(s.city);
                    setBusy(true);
                    void (async () => {
                      try {
                        const r = await searchAddress(s.city);
                        if (r) {
                          const hits = fixturesAtPoint(r.lng, r.lat);
                          setResult({ address: r.pretty, lat: r.lat, lng: r.lng, storms: hits });
                        }
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                  className="rounded-lg border border-border bg-background p-4 text-left transition-colors hover:border-copper/50"
                >
                  <p className="font-medium text-foreground">{s.city}</p>
                  <p className="mt-1 text-xs text-muted-foreground font-mono-num">
                    {s.max_hail_size_in.toFixed(2)}″ · {timeAgo(s.start_time)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <FinalCta />
      <SiteFooter />
    </main>
  );
}

function StormResultCard({ storm }: { storm: StormFixture }) {
  const c = hailColor(storm.max_hail_size_in);
  const n = synthesize(storm);
  return (
    <li className="rounded-xl border border-border bg-background p-5 flex items-start gap-4">
      <span
        className="inline-flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-md border"
        style={{ background: c.bg, borderColor: c.border }}
      >
        <span className="font-mono-num text-base font-medium leading-none" style={{ color: c.text }}>
          {storm.max_hail_size_in.toFixed(2)}″
        </span>
        <span className="text-[9px] uppercase tracking-wide-caps font-mono leading-none mt-1" style={{ color: c.text, opacity: 0.75 }}>
          {c.object}
        </span>
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-display text-lg font-medium tracking-tight-display text-foreground">
          {storm.city}
        </p>
        <p className="mt-1 text-xs font-mono-num text-foreground/55">
          {timeAgo(storm.start_time)} · storm id {storm.id.slice(-8)}
        </p>
        <p className="mt-2 text-sm text-foreground/85 leading-relaxed line-clamp-2">{n.body}</p>
        <Link
          href={`/storm/${storm.id}`}
          className="mt-2 inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wide-caps text-copper hover:text-copper-700"
        >
          Full storm record <span aria-hidden>→</span>
        </Link>
      </div>
    </li>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Wordmark size="md" pulse />
        <nav className="hidden items-center gap-8 md:flex">
          <Link href="/#how" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it works</Link>
          <Link href="/live" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Live storms</Link>
          <Link href="/claim" className="text-sm text-foreground">Claim lookup</Link>
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">Sign in</Link>
          <Link href="/sign-up" className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-teal-900">
            Start free trial <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </header>
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

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-12">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <Wordmark size="sm" />
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/live" className="hover:text-foreground">Live storms</Link>
            <Link href="/claim" className="hover:text-foreground">Claim lookup</Link>
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/sign-in" className="hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
