"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/marketing/primitives";

interface QA {
  q: string;
  a: string;
}

/**
 * Landing FAQ — honest answers, instrument styling.
 *
 * Content notes: the old footer link "how Ridgeline Roofing tripled their
 * close rate" referenced an unverifiable customer and is removed, as is
 * the "we have customers running both tools in parallel" claim (now a
 * suggestion, not a customer anecdote). Everything else is kept.
 */
const FAQS: QA[] = [
  {
    q: "What does Hail GPS cost?",
    a: "$899/year, flat. Unlimited team members, unlimited storms, nationwide coverage. No per-seat fees, no overage charges, no surprises.",
  },
  {
    q: "Where does the hail data come from?",
    a: "NOAA weather radar — the same government source the big hail-mapping tools and most insurance carriers rely on. New data lands on your map about every 2 minutes during an active storm, and every storm is searchable by address afterward.",
  },
  {
    q: "How accurate is the hail-size estimate?",
    a: "Radar hail sizes are estimates, not measurements — ours and everyone else's. Individual sizes carry roughly ±0.25\" of uncertainty, and we cross-check storms against ground reports where they exist. We publish our accuracy openly on the Accuracy page — measured against real ground truth, updated as storms are verified — instead of quoting a marketing number.",
  },
  {
    q: "Do you have a mobile app?",
    a: "Yes. iOS + Android, native, with map and alerts. Markers and addresses sync automatically with the desktop. While we're in private beta we send you the TestFlight / Play build directly after onboarding.",
  },
  {
    q: "What integrations are supported?",
    a: "Slack alerts out of the box, plus a documented public API you can point anything at. If you need a specific CRM connected, tell us at hello@hailgps.com and we'll talk it through.",
  },
  {
    q: "Can I switch from HailTrace or Interactive Hail Maps?",
    a: "Yes. The switch takes about 10 minutes — paste your customer address list into the bulk-import tool, invite your team, configure Slack. Existing storms backfill automatically. Run Hail GPS alongside your current tool for a week and compare the same storms before you cut over.",
  },
  {
    q: "How do I get started?",
    a: "Request access and we'll onboard your team directly — you'll see the same live map on your own territory before you commit.",
  },
  {
    q: "Who's behind Hail GPS?",
    a: "A small team building storm tools for roofing crews — part of the same family as PenSnap. Reach us at hello@hailgps.com; we read every email.",
  },
];

export function LandingFaq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="bg-background" id="faq">
      <div className="container max-w-6xl py-24 md:py-32">
        <SectionHeading
          align="center"
          eyebrow="FAQ"
          title="Straight answers."
        />

        <ul className="mx-auto mt-10 max-w-3xl divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card md:mt-12">
          {FAQS.map((item, i) => {
            const open = openIdx === i;
            return (
              <li key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="flex min-h-11 w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/40"
                  aria-expanded={open}
                >
                  <span className="text-base font-semibold text-foreground md:text-lg">
                    {item.q}
                  </span>
                  <svg
                    viewBox="0 0 16 16"
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform",
                      open ? "rotate-45 text-primary" : "text-muted-foreground",
                    )}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <path d="M8 3 L8 13 M3 8 L13 8" />
                  </svg>
                </button>
                {open && (
                  <div className="-mt-1 px-5 pb-5">
                    <p className="max-w-prose text-pretty text-sm leading-[1.65] text-muted-foreground md:text-base">
                      {item.a}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Still have questions?{" "}
          {/* Inline link: negative margin cancels the padding visually while
              keeping a ≥44px tap target. */}
          <a
            href="mailto:hello@hailgps.com"
            className="-my-3.5 inline-block py-3.5 text-primary hover:text-copper-700"
          >
            hello@hailgps.com
          </a>{" "}
          — we&apos;re a small team, expect a real reply.
        </p>
      </div>
    </section>
  );
}
