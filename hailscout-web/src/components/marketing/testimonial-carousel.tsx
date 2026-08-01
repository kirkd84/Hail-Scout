/**
 * "What crews use it for" — honest use-case vignettes.
 *
 * This file previously exported TestimonialCarousel: three quotes
 * attributed to named people at named companies ("Holloway Roofing",
 * "Cardinal Exteriors", "Apex Roofing") that are not verifiable
 * customers. Presenting invented endorsements as real violates the
 * site's honesty rules, so the carousel is gone. In its place: three
 * concrete moments where the product does the work, with no invented
 * attribution — and no carousel, so no dots to manage.
 *
 * Server-component-safe (no hooks).
 */

import { MarketingCard, SectionHeading } from "@/components/marketing/primitives";

const USE_CASES: { tag: string; title: string; body: string }[] = [
  {
    tag: "Storm morning",
    title: "Be first on the block",
    body:
      "The storm passed overnight. Open the map over coffee, see exactly where the swath ran and how big the hail got, and pick the streets worth working — before the first competitor truck is loaded.",
  },
  {
    tag: "On the doors",
    title: "Knock only roofs that were hit",
    body:
      "Standing on any street, tap an address and read the hail size at that exact roof. No wasted knocks outside the swath, and a straight answer when a homeowner asks \"did we even get hail?\"",
  },
  {
    tag: "The claim",
    title: "Give the adjuster something to check",
    body:
      "Hand over a report with the storm date, hail size, and swath map for the exact address — built from the same NOAA radar data most carriers already use. Not your word against theirs.",
  },
];

export function CrewUseCases() {
  return (
    <section className="bg-secondary/40">
      <div className="container max-w-6xl py-24 md:py-32">
        <SectionHeading
          eyebrow="In the field"
          title="What crews use it for."
          lede="No staged quotes here — just the three moments where the map earns its keep."
        />
        <div className="mt-10 grid gap-5 md:mt-12 md:grid-cols-3">
          {USE_CASES.map((u) => (
            <MarketingCard key={u.tag} className="p-7">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
                {u.tag}
              </p>
              <h3 className="mt-3 text-xl font-semibold text-foreground">{u.title}</h3>
              <p className="mt-2 text-base leading-[1.65] text-muted-foreground">{u.body}</p>
            </MarketingCard>
          ))}
        </div>
      </div>
    </section>
  );
}
