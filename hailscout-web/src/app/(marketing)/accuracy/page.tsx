"use client";

import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { StatTicker } from "@/components/marketing/stat-ticker";
import { ContourBg } from "@/components/brand/contour-bg";
import { useAccuracyStat } from "@/hooks/useAccuracyStat";

/**
 * Public accuracy dashboard — the "we show our work" page. Built from the
 * live LSR ground-truth calibration. The honest framing IS the differentiator:
 * no competitor publishes their accuracy at all.
 */
export default function AccuracyPage() {
  const a = useAccuracyStat();

  const pct = (v: number | null | undefined) =>
    v == null ? "—" : `${Math.round(v * 100)}%`;
  const hasCalib = !!a && a.sample_size > 0;

  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <StatTicker />

      <section className="relative overflow-hidden bg-topo">
        <ContourBg className="opacity-90" density="sparse" />
        <div className="container relative pb-12 pt-16 md:pb-16 md:pt-24 text-center">
          <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper">
            Accuracy · public
          </p>
          <h1 className="mx-auto mt-3 max-w-3xl font-display text-balance text-5xl font-medium leading-[1.05] tracking-tight-display text-foreground md:text-6xl">
            We show our work.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Every hail platform claims accuracy. We&apos;re the only one that
            publishes it — measured against National Weather Service ground
            reports, updated continuously, good numbers and bad.
          </p>
        </div>
      </section>

      {/* Headline confirmation count */}
      <section className="bg-card border-y border-border">
        <div className="container py-14 md:py-20 max-w-3xl text-center">
          {a?.headline ? (
            <p className="font-display text-3xl font-medium leading-snug tracking-tight-display text-foreground md:text-4xl">
              {a.headline}
            </p>
          ) : (
            <p className="font-display text-2xl font-medium leading-snug tracking-tight-display text-foreground">
              {a ? `${a.confirmed_events.toLocaleString()} ` : ""}detections
              independently confirmed by NWS ground reports — and counting.
            </p>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            Independent corroboration is the strongest evidence a hail claim can
            carry. It&apos;s the number we lead with — not a marketing
            &ldquo;99% accurate.&rdquo;
          </p>
        </div>
      </section>

      {/* Calibration metrics */}
      <section className="bg-background">
        <div className="container py-16 md:py-20 max-w-4xl">
          <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper text-center">
            Radar vs. ground truth
          </p>
          <h2 className="mt-3 text-center font-display text-3xl font-medium tracking-tight-display text-foreground md:text-4xl">
            How close is the radar size?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            For every storm a trained NWS spotter reported, we compare the hail
            size our radar showed <em>at that exact point</em> to what the
            spotter measured on the ground. Like-for-like, no cherry-picking.
          </p>

          {hasCalib ? (
            <>
              <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Within ¼ inch" value={pct(a!.within_quarter_inch)} sub="of the ground report" />
                <Metric label="Within ½ inch" value={pct(a!.within_half_inch)} sub="of the ground report" />
                <Metric label="Detection rate" value={pct(a!.detection_rate)} sub="reports with radar hail at the point" />
                <Metric label="Confirmed pairs" value={a!.confirmed_pairs.toLocaleString()} sub={`reports ≥ ${a!.min_size_in.toFixed(2)}″ compared`} />
              </div>
              <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground leading-relaxed">
                Straight talk: radar hail <em>sizing</em> is inherently scattered
                versus a spotter&apos;s ruler — that&apos;s true for every product
                on the market, ours included. That&apos;s exactly why we lead with
                independent confirmation and multi-source verification rather than
                a single radar number, and why every report shows its evidence.
              </p>
            </>
          ) : (
            <p className="mx-auto mt-10 max-w-xl text-center text-muted-foreground">
              The calibration sample is still growing as ground reports land. The
              confirmation count above updates live; the size-accuracy breakdown
              publishes once the verified-pair sample is large enough to be
              meaningful.
            </p>
          )}
        </div>
      </section>

      {/* Methodology */}
      <section className="bg-card border-y border-border">
        <div className="container py-16 max-w-2xl">
          <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper text-center">
            Methodology
          </p>
          <h2 className="mt-3 text-center font-display text-3xl font-medium tracking-tight-display text-foreground">
            No black box.
          </h2>
          <dl className="mt-10 space-y-7">
            <Faq q="What counts as “confirmed”?" a="A radar-detected hail cell whose swath contains an independent NWS Local Storm Report within ~30 minutes. Two independent observations of the same event — radar and a human on the ground." />
            <Faq q="How do you measure size accuracy?" a="We compare the radar's estimated hail size at the report's exact location against the size the spotter reported — not the storm's peak miles away. Apples to apples." />
            <Faq q="Why not just claim “99% accurate”?" a="Because it wouldn't be honest. Radar infers hail aloft; size estimates carry real uncertainty. We'd rather show the true numbers and win on verification and defensibility." />
            <Faq q="Where does the data come from?" a="NOAA MRMS, NEXRAD Level II dual-polarization radar, and NWS Local Storm Reports — all public, all citable in a claim." />
          </dl>
        </div>
      </section>

      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="container py-16 text-center md:py-20">
          <h2 className="font-display text-balance text-3xl font-medium tracking-tight-display md:text-4xl">
            Check any address yourself.
          </h2>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/claim" className="inline-flex items-center gap-2 rounded-md bg-copper px-5 py-3 text-sm font-medium text-primary-foreground shadow-atlas-lg hover:bg-copper-700">
              Look up an address <span aria-hidden>→</span>
            </Link>
            <Link href="/compare" className="inline-flex items-center gap-2 rounded-md border border-primary-foreground/20 bg-transparent px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10">
              Compare to HailTrace / IHM
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center shadow-atlas">
      <p className="font-display text-4xl font-medium tracking-tight-display text-primary">{value}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <dt className="font-display text-lg font-medium tracking-tight-display text-foreground">{q}</dt>
      <dd className="mt-2 text-muted-foreground leading-relaxed">{a}</dd>
    </div>
  );
}
