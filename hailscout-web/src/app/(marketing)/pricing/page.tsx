import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { SectionHeading, MarketingCard, CtaBand } from "@/components/marketing/primitives";
import { ContourBg } from "@/components/brand/contour-bg";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "One flat rate for the whole crew. Published pricing, unlimited team members, nationwide coverage.",
};

/**
 * /pricing — the cleanest page on the site.
 *
 * Two plan cards, mono prices, honest feature lists. No trial claims,
 * no invented tiers — the flat plan we sell today plus a "talk to us"
 * lane for multi-territory operators.
 */
export default function PricingPage() {
  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <PlanCards />
      <Promises />
      <Faq />
      <CtaBand
        title="See it on your own territory first."
        lede="Request access and we'll set your team up on the live map before you commit to anything."
        primary={{ label: "Request access", href: "/request-access" }}
        secondary={{ label: "Compare the field", href: "/compare" }}
      />
      <SiteFooter />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <ContourBg density="sparse" className="opacity-60" />
      <div className="container relative max-w-6xl pb-16 pt-20 text-center md:pb-20 md:pt-28">
        <p className="eyebrow">Pricing</p>
        <h1 className="display-1 mx-auto mt-4 max-w-3xl text-foreground">
          One flat rate.
          <span className="block text-primary">Every storm. Every state.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-prose text-base leading-[1.65] text-muted-foreground">
          The number is published right here. Unlimited team members, nationwide
          coverage, and a real person to get your crew set up.
        </p>
      </div>
    </section>
  );
}

interface Plan {
  name: string;
  blurb: string;
  /** Mono price string, e.g. "$899". Null renders the customLabel. */
  price: string | null;
  priceSuffix?: string;
  customLabel?: string;
  cta: { label: string; href: string; variant: "primary" | "secondary" };
  features: string[];
  recommended?: boolean;
  footnote?: string;
}

/**
 * Honest plan facts only: everything in the Starter list ships today
 * (live map, at-address size history, radar loop, outlook heads-up,
 * alerts, pins, reports, API). No "coming soon" feature promises.
 */
const PLANS: Plan[] = [
  {
    name: "Starter",
    blurb: "The whole product, for the whole crew. One price, no per-seat math.",
    price: "$899",
    priceSuffix: "/year",
    cta: { label: "Request access", href: "/request-access", variant: "primary" },
    features: [
      "Live hail map for the whole country — new data lands about every 2 minutes during a storm",
      "Hail history at any address, with storms on record back to 2021",
      "Live radar loop, so you can watch a storm as it moves",
      "Storm alerts by email, text, Slack, or a notification on your phone",
      "A morning heads-up on days hail is forecast for your area",
      "Canvassing pins your whole crew can see and update",
      "Hail reports you can hand to a homeowner or an adjuster",
      "Unlimited team members — headcount never changes the bill",
      "Public API access for your own tools",
      "Hands-on setup with a real person",
    ],
    recommended: true,
  },
  {
    name: "Multi-territory",
    blurb: "Running several offices or markets under one roof? Let's talk directly.",
    price: null,
    customLabel: "Custom",
    cta: { label: "Talk to us", href: "mailto:hello@hailgps.com", variant: "secondary" },
    features: [
      "Everything in Starter",
      "Multiple offices or territories under one account",
      "Volume and multi-year pricing",
      "A direct line to the team that builds the product",
    ],
    footnote: "No published price here because it genuinely depends on your setup — we'll quote it in one email, not a sales sequence.",
  },
];

function PlanCards() {
  return (
    <section className="py-24 md:py-32">
      <div className="container max-w-6xl">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <MarketingCard
              key={plan.name}
              elevated={plan.recommended}
              className={cn("relative flex flex-col p-7", plan.recommended && "border-primary/50")}
            >
              {plan.recommended && (
                <span className="absolute -top-3 left-7 inline-flex items-center rounded-full bg-primary px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-primary-foreground">
                  Recommended
                </span>
              )}
              <h2 className="text-xl font-semibold text-foreground">{plan.name}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{plan.blurb}</p>

              <div className="mt-6 flex items-baseline gap-2">
                {plan.price ? (
                  <>
                    <span className="font-mono-num text-5xl font-semibold tracking-tight text-foreground">
                      {plan.price}
                    </span>
                    <span className="font-mono text-sm text-muted-foreground">{plan.priceSuffix}</span>
                  </>
                ) : (
                  <span className="font-mono-num text-5xl font-semibold tracking-tight text-foreground">
                    {plan.customLabel}
                  </span>
                )}
              </div>
              {plan.price && (
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Flat · unlimited seats
                </p>
              )}

              <Link
                href={plan.cta.href}
                className={cn(
                  "mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-5 text-sm font-medium transition-colors",
                  plan.cta.variant === "primary"
                    ? "bg-primary text-primary-foreground hover:bg-copper-700"
                    : "border border-border text-foreground hover:bg-card",
                )}
              >
                {plan.cta.label} <span aria-hidden>→</span>
              </Link>

              <ul className="mt-7 space-y-3 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-foreground/85">
                    <CheckIcon />
                    <span className="leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>

              {plan.footnote && (
                <p className="mt-6 border-t border-border/60 pt-4 text-xs leading-relaxed text-muted-foreground">
                  {plan.footnote}
                </p>
              )}
            </MarketingCard>
          ))}
        </div>
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden>
      <path
        d="M3 8.5L6.5 12L13 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const PROMISES: { k: string; v: string }[] = [
  {
    k: "Published price",
    v: "The number's right here. No “request a demo” just to find out what it costs.",
  },
  {
    k: "No per-seat tax",
    v: "Your whole crew and sales team are included. Headcount never changes the bill.",
  },
  {
    k: "See it before you commit",
    v: "We set your team up and walk you through the live map on your own territory first.",
  },
  {
    k: "Personal onboarding",
    v: "A real person gets your crew canvassing — not a form and a shrug.",
  },
];

function Promises() {
  return (
    <section className="border-y border-border bg-secondary/40 py-24 md:py-32">
      <div className="container max-w-6xl">
        <SectionHeading
          eyebrow="How we sell"
          title="No quote games."
          lede="Every other hail platform makes you sit through a sales call just to see a price. We don't."
          align="center"
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map((p) => (
            <div key={p.k} className="flex items-start gap-3">
              <CheckIcon />
              <div>
                <p className="text-base font-semibold text-foreground">{p.k}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.v}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Why publish your pricing when the big names hide theirs?",
    a: "Because you shouldn't have to sit through a sales call just to learn what a tool costs. Our price is the same whether you run one truck or forty — published, flat, and honest.",
  },
  {
    q: "How do I get started?",
    a: (
      <>
        Request access and we&apos;ll set your team up directly — you&apos;ll see the live
        map on your own territory before you commit. Email{" "}
        <a href="mailto:hello@hailgps.com" className="text-primary hover:text-copper-700">
          hello@hailgps.com
        </a>{" "}
        or hit Request access.
      </>
    ),
  },
  {
    q: "How many team members can I invite?",
    a: "Unlimited. Add your whole crew and your sales team — no per-seat charges, ever.",
  },
  {
    q: "Where does the hail data come from?",
    a: "The national weather radar network, layered with ground hail reports from trained spotters. Our archive goes back to 2021 and grows with every storm.",
  },
  {
    q: "How accurate is it?",
    a: (
      <>
        We measure our radar sizes against ground-truth hail reports and publish the
        numbers live —{" "}
        <Link href="/accuracy" className="text-primary hover:text-copper-700">
          see the accuracy page
        </Link>
        . We&apos;d rather show you the measurement than make a claim.
      </>
    ),
  },
  {
    q: "Do you offer discounts?",
    a: "Pricing shown is already annual. Multi-territory and multi-year pricing is available — just email us and we'll sort it out, no pressure.",
  },
];

function Faq() {
  return (
    <section className="py-24 md:py-32">
      <div className="container max-w-6xl">
        <div className="mx-auto max-w-2xl">
          <SectionHeading
            eyebrow="Frequently asked"
            title="The fine print, in plain English."
            align="center"
          />
          <dl className="mt-12 space-y-8">
            {FAQS.map((item) => (
              <div key={item.q}>
                <dt className="text-lg font-semibold text-foreground">{item.q}</dt>
                <dd className="mt-2 max-w-prose leading-[1.65] text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
