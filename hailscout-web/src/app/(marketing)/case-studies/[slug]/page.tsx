/**
 * /case-studies/[slug] — full case study, atlas-page editorial layout.
 */

import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { CASE_STUDIES, getCaseStudy } from "@/lib/case-studies";

export async function generateStaticParams() {
  return CASE_STUDIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cs = getCaseStudy(slug);
  if (!cs) return {};
  return {
    title: cs.headline,
    description: cs.deck,
  };
}

export default async function CaseStudyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cs = getCaseStudy(slug);
  if (!cs) notFound();

  return (
    <>
      <SiteHeader />
      <div className="bg-cream text-foreground">
      {/* Hero */}
      <div className="border-b border-border">
        <div className="container max-w-4xl py-24">
          <Link
            href="/case-studies"
            className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper hover:text-copper-700"
          >
            ← Customer stories
          </Link>
          <p className="mt-6 font-mono-num text-[11px] uppercase tracking-wide-caps text-foreground/55">
            {cs.region} · {cs.companySize}
          </p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl font-medium tracking-tight-display text-teal-900">
            {cs.headline}
          </h1>
          <p className="mt-5 max-w-2xl text-xl text-foreground/70 leading-relaxed">
            {cs.deck}
          </p>
        </div>
      </div>

      {/* Stat band */}
      <div className="bg-teal-900 text-cream">
        <div className="container max-w-4xl py-12">
          <div className="grid grid-cols-3 gap-8">
            {cs.stats.map((s) => (
              <div key={s.label}>
                <p className="font-display text-5xl md:text-6xl font-medium tracking-tight-display text-copper">
                  {s.value}
                </p>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-wide-caps text-cream/70">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="container max-w-3xl py-20 prose-atlas">
        {cs.sections.map((sec, i) => (
          <section key={i} className="mb-12">
            <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper">
              {sec.eyebrow}
            </p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl tracking-tight-display text-teal-900">
              {sec.heading}
            </h2>
            <div className="mt-5 space-y-5 text-lg text-foreground/80 leading-relaxed">
              {sec.paragraphs.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
            {sec.pullQuote && (
              <blockquote className="mt-8 border-l-2 border-copper pl-6 py-2">
                <p className="font-display text-2xl md:text-3xl tracking-tight-display text-teal-900 italic leading-snug">
                  &ldquo;{sec.pullQuote.text}&rdquo;
                </p>
                <footer className="mt-3 font-mono text-[11px] uppercase tracking-wide-caps text-foreground/55">
                  — {sec.pullQuote.attribution}
                </footer>
              </blockquote>
            )}
          </section>
        ))}
      </div>

      {/* CTA */}
      <div className="border-t border-border">
        <div className="container max-w-3xl py-20 text-center">
          <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper">
            Field guide
          </p>
          <h2 className="mt-2 font-display text-4xl md:text-5xl tracking-tight-display text-teal-900">
            See what hit your market.
          </h2>
          <p className="mt-4 max-w-xl mx-auto text-lg text-foreground/70">
            Every storm, every polygon, every roof. Try it on your own zip code.
          </p>
          <div className="mt-8 flex justify-center gap-3 flex-wrap">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-md bg-copper px-6 py-3 text-sm font-medium text-white shadow-atlas hover:bg-copper-700"
            >
              Start free <span aria-hidden>→</span>
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-cream px-6 py-3 text-sm font-medium text-teal-900 hover:border-copper/50"
            >
              See pricing
            </Link>
          </div>
        </div>
      </div>
    </div>
      <SiteFooter />
    </>
  );
}
