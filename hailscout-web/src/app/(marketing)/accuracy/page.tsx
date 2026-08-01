"use client";

import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { StatTicker } from "@/components/marketing/stat-ticker";
import { ContourBg } from "@/components/brand/contour-bg";
import { CtaBand, MarketingCard, SectionHeading } from "@/components/marketing/primitives";
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

      <section className="relative overflow-hidden">
        <ContourBg className="opacity-80" density="sparse" />
        <div className="container relative max-w-6xl pb-12 pt-16 text-center md:pb-16 md:pt-24">
          <p className="eyebrow">Accuracy · public</p>
          <h1 className="display-1 mx-auto mt-4 max-w-3xl text-foreground">
            We show our work.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-[1.65] text-muted-foreground text-pretty">
            Every hail platform claims accuracy. We&apos;re the only one that
            publishes it — measured against National Weather Service ground
            reports, updated continuously, good numbers and bad.
          </p>
        </div>
      </section>

      {/* Headline confirmation count */}
      <section className="border-y border-border bg-secondary/40">
        <div className="container max-w-3xl py-14 text-center md:py-20">
          {a?.headline ? (
            <p className="display-2 text-foreground">{a.headline}</p>
          ) : (
            <p className="display-2 text-foreground">
              {a ? (
                <span className="font-mono-num tabular-nums text-primary">
                  {a.confirmed_events.toLocaleString()}{" "}
                </span>
              ) : null}
              detections independently confirmed by NWS ground reports — and
              counting.
            </p>
          )}
          <p className="mx-auto mt-4 max-w-prose text-sm leading-[1.65] text-muted-foreground">
            Independent corroboration is the strongest evidence a hail claim can
            carry. It&apos;s the number we lead with — not a marketing
            &ldquo;99% accurate.&rdquo;
          </p>
        </div>
      </section>

      {/* Calibration metrics */}
      <section className="bg-background bg-graticule">
        <div className="container max-w-6xl py-24 md:py-32">
          <SectionHeading
            align="center"
            eyebrow="Radar vs. ground truth"
            title="How close is the radar size?"
            lede={
              <>
                For every storm a trained NWS spotter reported, we compare the
                hail size our radar showed <em>at that exact point</em> to what
                the spotter measured on the ground. Like-for-like, no
                cherry-picking.
              </>
            }
          />

          {hasCalib ? (
            <>
              <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Within ¼ inch" value={pct(a!.within_quarter_inch)} sub="of the ground report" />
                <Metric label="Within ½ inch" value={pct(a!.within_half_inch)} sub="of the ground report" />
                <Metric label="Detection rate" value={pct(a!.detection_rate)} sub="reports with radar hail at the point" />
                <Metric label="Confirmed pairs" value={a!.confirmed_pairs.toLocaleString()} sub={`reports ≥ ${a!.min_size_in.toFixed(2)}″ compared`} />
              </div>
              <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-[1.65] text-muted-foreground">
                Straight talk: radar hail <em>sizing</em> is inherently scattered
                versus a spotter&apos;s ruler — that&apos;s true for every product
                on the market, ours included. That&apos;s exactly why we lead with
                independent confirmation and multi-source verification rather than
                a single radar number, and why every report shows its evidence.
              </p>
            </>
          ) : (
            <div className="mx-auto mt-12 max-w-xl rounded-xl border border-border bg-card p-8 text-center">
              <p className="font-mono text-[11px] uppercase tracking-wide-caps text-foreground/45">
                Sample still growing
              </p>
              <p className="mt-3 text-muted-foreground">
                The calibration sample is still growing as ground reports land.
                The confirmation count above updates live; the size-accuracy
                breakdown publishes once the verified-pair sample is large
                enough to be meaningful.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Methodology */}
      <section className="border-y border-border bg-secondary/40">
        <div className="container max-w-2xl py-24 md:py-32">
          <SectionHeading
            align="center"
            eyebrow="Methodology"
            title="No black box."
          />
          <dl className="mt-12 space-y-8">
            <Faq q="What counts as “confirmed”?" a="A radar-detected hail cell whose swath contains an independent NWS Local Storm Report within ~30 minutes. Two independent observations of the same event — radar and a human on the ground." />
            <Faq q="How do you measure size accuracy?" a="We compare the radar's estimated hail size at the report's exact location against the size the spotter reported — not the storm's peak miles away. Apples to apples." />
            <Faq q="Why not just claim “99% accurate”?" a="Because it wouldn't be honest. Radar infers hail aloft; size estimates carry real uncertainty. We'd rather show the true numbers and win on verification and defensibility." />
            <Faq q="Where does the data come from?" a="NOAA's radar networks (MRMS and NEXRAD) plus National Weather Service ground reports — all public, all citable in a claim." />
          </dl>
        </div>
      </section>

      <CtaBand
        title="Check any address yourself."
        lede="Search a property, see every hail event on record there, and read the evidence behind each one."
        primary={{ label: "Look up an address", href: "/claim" }}
        secondary={{ label: "Compare to HailTrace / IHM", href: "/compare" }}
      />

      <SiteFooter />
    </main>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <MarketingCard className="text-center">
      <p className="font-mono-num text-4xl font-medium tabular-nums text-primary md:text-5xl">
        {value}
      </p>
      <p className="mt-3 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </MarketingCard>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <dt className="text-lg font-semibold tracking-tight text-foreground">{q}</dt>
      <dd className="mt-2 max-w-prose leading-[1.65] text-muted-foreground">{a}</dd>
    </div>
  );
}
