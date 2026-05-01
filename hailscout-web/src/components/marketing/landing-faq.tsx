"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface QA {
  q: string;
  a: string;
}

const FAQS: QA[] = [
  {
    q: "What does HailScout cost?",
    a: "$899/year, flat. Unlimited team members, unlimited storms, nationwide coverage. No per-seat fees, no overage charges, no surprises. We charge a fraction of HailTrace ($3-8k/yr) and IHM ($1,999/yr) because the unit economics work and we'd rather earn through breadth than squeeze each customer.",
  },
  {
    q: "Where does the hail data come from?",
    a: "NOAA's Multi-Radar Multi-Sensor (MRMS) feed — the same source HailTrace, IHM, and most insurance carriers use. Real-time swaths refresh every 2 minutes during active storms. We run a lightweight pipeline that extracts hail polygons, indexes them by spatial bin, and surfaces matches at the address level.",
  },
  {
    q: "How accurate is the hail-size estimate?",
    a: "Hail detection (i.e., 'did hail fall here?') is 95%+ accurate. Individual size estimates carry ±0.25\" uncertainty — same as every other MRMS-based product on the market. For legal-grade claims, on-demand meteorologist review is available.",
  },
  {
    q: "Do you have a mobile app?",
    a: "Yes. iOS + Android, native, with map and alerts. Markers and addresses sync automatically with the desktop. Available on the App Store and Google Play once we exit private beta — sign up and we'll TestFlight you the build today.",
  },
  {
    q: "What integrations are supported?",
    a: "Slack incoming-webhooks (out of the box). The product API is fully documented and CRM integrations (AccuLynx, JobNimbus, ServiceTitan) are on the immediate roadmap — talk to sales if you need a specific one.",
  },
  {
    q: "Can I switch from HailTrace or Interactive Hail Maps?",
    a: "Yes. The switch takes about 10 minutes — paste your customer address list into the bulk-import tool, invite your team, configure Slack. Existing storms backfill automatically. We have customers running both tools in parallel for a week before cutting over; that pattern works well.",
  },
  {
    q: "Is there a free trial?",
    a: "14 days, full access, no credit card required. You'll get the same atlas your paying customers see — with a banner at the top reminding you to upgrade when you're ready. Cancel anytime in one click.",
  },
  {
    q: "Who's behind HailScout?",
    a: "A small team of weather data engineers and former roofing-software product folks. We've built this for crews who beat the storm to the door. Reach us at hello@hailscout.com — we read every email.",
  },
];

export function LandingFaq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="bg-card border-y border-border" id="faq">
      <div className="container py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper">
            Frequently asked
          </p>
          <h2 className="mt-3 font-display text-4xl font-medium tracking-tight-display text-foreground md:text-5xl">
            What people ask before signing up.
          </h2>
        </div>

        <ul className="mx-auto max-w-3xl divide-y divide-border/60 rounded-xl border border-border bg-background overflow-hidden">
          {FAQS.map((item, i) => {
            const open = openIdx === i;
            return (
              <li key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/30"
                  aria-expanded={open}
                >
                  <span className="font-display text-lg font-medium tracking-tight-display text-foreground">
                    {item.q}
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-foreground/70 transition-all",
                      open ? "rotate-45 border-copper text-copper" : "",
                    )}
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M8 3 L8 13 M3 8 L13 8" />
                    </svg>
                  </span>
                </button>
                {open && (
                  <div className="px-5 pb-5 -mt-1">
                    <p className="text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
                      {item.a}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-8 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Still have questions?{" "}
            <a href="mailto:hello@hailscout.com" className="text-copper hover:text-copper-700">
              hello@hailscout.com
            </a>
            {" "}— we&apos;re a small team, expect a real reply.
          </p>
          <p className="text-sm text-muted-foreground">
            Or read{" "}
            <a href="/case-studies" className="text-copper hover:text-copper-700">
              how Ridgeline Roofing tripled their close rate →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
