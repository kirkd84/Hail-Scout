/**
 * /case-studies — index page listing customer stories.
 * Atlas-page editorial layout, cream/teal/copper.
 */

import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { type Metadata } from "next";
import { CASE_STUDIES } from "@/lib/case-studies";

export const metadata: Metadata = {
  title: "Customer stories | HailScout",
  description:
    "How roofing contractors are using HailScout to close more jobs after the storm.",
};

export default function CaseStudiesIndex() {
  return (
    <>
      <SiteHeader />
      <div className="bg-cream text-foreground">
      <div className="container max-w-5xl py-24">
        <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
          Customer stories
        </p>
        <h1 className="mt-3 font-display text-5xl md:text-6xl font-medium tracking-tight-display text-teal-900">
          The atlas, in the field.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-foreground/70">
          What real crews built when they swapped polygon-grade hail data for
          hardware-store guesswork.
        </p>

        <div className="mt-16 rule-atlas" />

        <div className="mt-12 grid gap-10 md:grid-cols-2">
          {CASE_STUDIES.map((cs) => (
            <Link
              key={cs.slug}
              href={`/case-studies/${cs.slug}`}
              className="group block"
            >
              <div className="aspect-[4/3] rounded-lg overflow-hidden border border-border bg-secondary/30 relative">
                {/* Topographic motif card */}
                <svg
                  viewBox="0 0 400 300"
                  preserveAspectRatio="none"
                  className="w-full h-full"
                  aria-hidden
                >
                  <defs>
                    <linearGradient id={`grad-${cs.slug}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--teal-700))" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="hsl(var(--teal-900))" stopOpacity="0.85" />
                    </linearGradient>
                  </defs>
                  <rect width="400" height="300" fill={`url(#grad-${cs.slug})`} />
                  <g fill="none" stroke="#F5F1EA" strokeWidth="0.6" opacity="0.18">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <path
                        key={i}
                        d={`M-20,${30 + i * 32} Q120,${15 + i * 32} 220,${30 + i * 32} T420,${22 + i * 32}`}
                      />
                    ))}
                  </g>
                  {/* Copper paint stroke storm trail */}
                  <path
                    d="M40,220 Q140,160 240,180 T380,140"
                    fill="none"
                    stroke="#D87C4A"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    opacity="0.9"
                  />
                </svg>
              </div>
              <div className="mt-5 space-y-2">
                <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper">
                  {cs.region}
                </p>
                <h2 className="font-display text-3xl tracking-tight-display text-teal-900 group-hover:text-copper transition-colors">
                  {cs.headline}
                </h2>
                <p className="text-foreground/70">{cs.deck}</p>
                <p className="font-mono text-[11px] uppercase tracking-wide-caps text-foreground/55 inline-flex items-center gap-2">
                  Read the story
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
      <SiteFooter />
    </>
  );
}
