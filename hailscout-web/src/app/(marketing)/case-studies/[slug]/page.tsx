/**
 * /case-studies/[slug] — one playbook: a timeline walkthrough of how a
 * crew runs Hail GPS. Honest framing throughout: workflow, not a
 * customer story. Clock times are labeled illustrative; hail sizes in
 * the step chips use the real data ramp (hailColor) because they show
 * what the product's size bands look like.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { CtaBand } from "@/components/marketing/primitives";
import { hailColor } from "@/lib/hail";
import { PLAYBOOKS, getPlaybook } from "../_content";

export async function generateStaticParams() {
  return PLAYBOOKS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pb = getPlaybook(slug);
  if (!pb) return {};
  return {
    title: `${pb.title} — how crews run Hail GPS`,
    description: pb.deck,
  };
}

export default async function PlaybookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pb = getPlaybook(slug);
  if (!pb) notFound();

  return (
    <main className="bg-background text-foreground">
      <SiteHeader />

      {/* Hero */}
      <section className="border-b border-border/60">
        <div className="container max-w-6xl pb-14 pt-16 md:pb-16 md:pt-24">
          <Link
            href="/case-studies"
            className="inline-flex min-h-11 items-center font-mono text-[11px] uppercase tracking-[0.14em] text-primary hover:text-copper-700"
          >
            ← Playbooks
          </Link>
          <p className="eyebrow mt-4">Playbook · {pb.timeframe}</p>
          <h1 className="display-1 mt-3 max-w-3xl text-foreground">{pb.title}</h1>
          <p className="mt-5 max-w-prose text-base leading-[1.65] text-muted-foreground">
            {pb.deck}
          </p>
          <p className="mt-6 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            Workflow walkthrough — not a customer story. Times are illustrative.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-24 md:py-32">
        <div className="container max-w-6xl">
          <div className="mx-auto max-w-3xl">
            {pb.phases.map((phase, pi) => (
              <div key={phase.heading} className={pi > 0 ? "mt-16" : undefined}>
                <p className="eyebrow">{phase.eyebrow}</p>
                <h2 className="display-2 mt-3 text-foreground">{phase.heading}</h2>

                <ol className="mt-8 space-y-0">
                  {phase.steps.map((step, si) => (
                    <li
                      key={step.title}
                      className="relative grid grid-cols-[3.5rem_1fr] gap-x-4 sm:grid-cols-[4.5rem_1fr] sm:gap-x-6"
                    >
                      {/* Time rail */}
                      <div className="relative flex flex-col items-end">
                        <span className="font-mono-num pt-1 text-xs tabular-nums text-muted-foreground">
                          {step.time}
                        </span>
                        {si < phase.steps.length - 1 && (
                          <span
                            className="absolute right-[-0.5px] top-7 bottom-0 hidden w-px bg-border sm:block"
                            aria-hidden
                          />
                        )}
                      </div>

                      {/* Step card */}
                      <div className={si < phase.steps.length - 1 ? "pb-8" : undefined}>
                        <div className="rounded-xl border border-border bg-card p-6">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
                            {step.surface && (
                              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                                {step.surface}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 max-w-prose text-sm leading-[1.65] text-muted-foreground">
                            {step.body}
                          </p>
                          {step.sizes && step.sizes.length > 0 && (
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              {step.sizes.map((size) => {
                                const c = hailColor(size);
                                return (
                                  <span
                                    key={size}
                                    className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5"
                                    style={{ background: c.bg, borderColor: c.border }}
                                  >
                                    <span
                                      className="inline-block h-2.5 w-2.5 rounded-full"
                                      style={{ background: c.solid }}
                                      aria-hidden
                                    />
                                    <span className="font-mono-num text-xs font-medium tabular-nums text-foreground">
                                      {c.short}
                                    </span>
                                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                      {c.object}
                                    </span>
                                  </span>
                                );
                              })}
                              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                                Example size bands
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="See what hit your market."
        lede="Every storm on record, every size band, every roof — try it on your own zip code."
        primary={{ label: "Request access", href: "/request-access" }}
        secondary={{ label: "See pricing", href: "/pricing" }}
      />

      <SiteFooter />
    </main>
  );
}
