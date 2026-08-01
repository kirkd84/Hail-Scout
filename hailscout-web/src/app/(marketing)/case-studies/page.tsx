/**
 * /case-studies — "How crews run Hail GPS".
 *
 * Reframed from fictional customer stories to honest scenario
 * walkthroughs. See _content.ts for the reasoning; the URL stays
 * /case-studies so nav, footer, and sitemap links keep working.
 */

import Link from "next/link";
import { type Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { CtaBand } from "@/components/marketing/primitives";
import { ContourBg } from "@/components/brand/contour-bg";
import { PLAYBOOKS } from "./_content";

export const metadata: Metadata = {
  title: "How crews run Hail GPS",
  description:
    "Scenario walkthroughs — the storm day and the canvassing week — showing how roofing crews use Hail GPS in the field.",
};

export default function PlaybooksIndex() {
  return (
    <main className="bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border/60">
        <ContourBg density="sparse" className="opacity-60" />
        <div className="container relative max-w-6xl pb-16 pt-20 md:pb-20 md:pt-28">
          <p className="eyebrow">Playbooks</p>
          <h1 className="display-1 mt-4 max-w-3xl text-foreground">
            How crews run Hail GPS.
          </h1>
          <p className="mt-5 max-w-prose text-base leading-[1.65] text-muted-foreground">
            Two walkthroughs — a storm day and a canvassing week — showing
            where the product fits, hour by hour. Every capability in them is
            shipped; the scenarios are illustrations, not customer results.
          </p>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="container max-w-6xl">
          <div className="grid gap-8 md:grid-cols-2">
            {PLAYBOOKS.map((pb) => (
              <Link
                key={pb.slug}
                href={`/case-studies/${pb.slug}`}
                className="group block rounded-xl border border-border bg-card transition-colors hover:border-primary/40"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl border-b border-border bg-teal-900">
                  <PlaybookPlate seed={pb.slug} />
                  <span className="absolute left-5 top-5 font-mono text-[10px] uppercase tracking-[0.14em] text-cream-50/60">
                    {pb.timeframe}
                  </span>
                </div>
                <div className="space-y-2 p-6">
                  <h2 className="display-2 text-foreground transition-colors group-hover:text-primary">
                    {pb.title}
                  </h2>
                  <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                    {pb.deck}
                  </p>
                  <p className="inline-flex min-h-11 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
                    Read the walkthrough
                    <span className="transition-transform group-hover:translate-x-1" aria-hidden>
                      →
                    </span>
                  </p>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 rounded-xl border border-border bg-secondary/40 p-6">
            <p className="eyebrow">Why no customer stories yet</p>
            <p className="mt-3 max-w-prose text-sm leading-[1.65] text-muted-foreground">
              We won&apos;t invent a roofing company, a founder quote, or a
              revenue number to make this page look busier. When real
              customers give us permission to publish real results, they&apos;ll
              live here — with numbers you can call and check. Until then,
              these walkthroughs show exactly how the product is meant to be
              run, and{" "}
              <Link href="/accuracy" className="text-primary hover:text-copper-700">
                the accuracy page
              </Link>{" "}
              shows how the data holds up.
            </p>
          </div>
        </div>
      </section>

      <CtaBand
        title="Run it on your own territory."
        lede="Request access and we'll set your crew up on the live map — your storms, your streets, before you commit."
        primary={{ label: "Request access", href: "/request-access" }}
        secondary={{ label: "See pricing", href: "/pricing" }}
      />

      <SiteFooter />
    </main>
  );
}

/**
 * Dark map-plate card art: slate ground, quiet contours, a cyan storm
 * trail. Decorative only — no data claims, so no data colors.
 */
function PlaybookPlate({ seed }: { seed: string }) {
  const flip = seed.length % 2 === 0;
  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden
    >
      <g fill="none" stroke="#F8FAFC" strokeWidth="0.6" opacity="0.14">
        {Array.from({ length: 9 }).map((_, i) => (
          <path
            key={i}
            d={`M-20,${30 + i * 32} Q120,${15 + i * 32} 220,${30 + i * 32} T420,${22 + i * 32}`}
          />
        ))}
      </g>
      <g fill="none" stroke="#F8FAFC" strokeWidth="0.5" opacity="0.08">
        <path d="M100,-10 V310 M200,-10 V310 M300,-10 V310" />
      </g>
      <path
        d={flip ? "M40,220 Q140,160 240,180 T380,140" : "M30,120 Q140,190 250,160 T390,210"}
        fill="none"
        stroke="#22D3EE"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.9"
      />
      <circle cx={flip ? 380 : 390} cy={flip ? 140 : 210} r="6" fill="none" stroke="#22D3EE" strokeWidth="1.5" opacity="0.7" />
      <circle cx={flip ? 380 : 390} cy={flip ? 140 : 210} r="2.5" fill="#22D3EE" />
    </svg>
  );
}
