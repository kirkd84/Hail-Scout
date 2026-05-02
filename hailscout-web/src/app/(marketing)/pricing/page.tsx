import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { StatTicker } from "@/components/marketing/stat-ticker";
import { ContourBg } from "@/components/brand/contour-bg";

export default function PricingPage() {
  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <StatTicker />
      <Hero />
      <PricingGrid />
      <Faq />
      <FinalCta />
      <SiteFooter />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-topo">
      <ContourBg className="opacity-90" density="sparse" />
      <div className="container relative pb-12 pt-16 md:pb-20 md:pt-24 text-center">
        <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper">Pricing</p>
        <h1 className="mx-auto mt-3 max-w-3xl font-display text-balance text-5xl font-medium leading-[1.05] tracking-tight-display text-foreground md:text-6xl">
          One flat rate.
          <span className="block text-primary">Every storm. Every state.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Unlimited team members. Unlimited storms. Nationwide coverage. No per-seat tax.
        </p>
      </div>
    </section>
  );
}

interface Tier {
  name: string;
  blurb: string;
  price: number | null;
  priceLabel?: string;
  cta: { label: string; href: string };
  features: string[];
  highlight?: boolean;
  comingSoon?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Starter",
    blurb: "For small roofing contractors getting started.",
    price: 899,
    priceLabel: "/year",
    cta: { label: "Start free trial", href: "/sign-up" },
    features: [
      "Nationwide hail mapping — live + 15yr archive",
      "Unlimited team members",
      "Address search & monitoring",
      "AI-drafted Hail Impact Reports",
      "Canvassing markers",
      "Email support",
    ],
    highlight: true,
  },
  {
    name: "Pro",
    blurb: "For growth-stage contractors with a sales team.",
    price: 1499,
    priceLabel: "/year",
    cta: { label: "Notify me", href: "/sign-up" },
    features: [
      "Everything in Starter",
      "Photo damage AI triage",
      "Advanced analytics dashboard",
      "CRM integrations (AccuLynx, JobNimbus)",
      "Priority support",
      "Custom branding on reports",
    ],
    comingSoon: true,
  },
  {
    name: "Enterprise",
    blurb: "For multi-territory operators and franchises.",
    price: null,
    priceLabel: "Custom",
    cta: { label: "Contact sales", href: "mailto:hello@hailscout.com" },
    features: [
      "Everything in Pro",
      "Dedicated meteorologist review",
      "White-label option",
      "Custom integrations",
      "SLA guarantee",
      "Phone + email support",
    ],
    comingSoon: true,
  },
];

function PricingGrid() {
  return (
    <section className="bg-background">
      <div className="container py-16 md:py-24">
        <div className="grid gap-6 md:grid-cols-3">
          {TIERS.map((t) => (
            <article
              key={t.name}
              className={`relative rounded-xl border bg-card p-7 shadow-atlas transition-all ${
                t.highlight ? "border-copper shadow-atlas-lg" : "border-border"
              }`}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-7 inline-flex items-center gap-1.5 rounded-full bg-copper px-3 py-1 text-[10px] font-mono uppercase tracking-wide-caps text-primary-foreground shadow-atlas">
                  Recommended
                </span>
              )}
              {t.comingSoon && (
                <span className="absolute -top-3 right-7 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[10px] font-mono uppercase tracking-wide-caps text-muted-foreground">
                  Coming soon
                </span>
              )}
              <h3 className="font-display text-2xl font-medium tracking-tight-display text-foreground">
                {t.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.blurb}</p>

              <div className="mt-6 flex items-baseline gap-2">
                {t.price === null ? (
                  <span className="font-display text-4xl font-medium tracking-tight-display text-primary">
                    {t.priceLabel}
                  </span>
                ) : (
                  <>
                    <span className="font-display text-5xl font-medium tracking-tight-display text-primary">
                      ${t.price}
                    </span>
                    <span className="text-sm text-muted-foreground">{t.priceLabel}</span>
                  </>
                )}
              </div>

              <Link
                href={t.cta.href}
                className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-medium shadow-atlas transition-colors ${
                  t.highlight
                    ? "bg-primary text-primary-foreground hover:bg-teal-900"
                    : "border border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {t.cta.label} <span aria-hidden>→</span>
              </Link>

              <ul className="mt-7 space-y-3 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-foreground/85">
                    <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 text-copper" aria-hidden>
                      <path
                        d="M3 8.5L6.5 12L13 4.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQS: { q: string; a: string }[] = [
  {
    q: "Can I try for free?",
    a: "Yes. 14 days full access to Starter, no credit card required. The atlas is yours to explore from day one.",
  },
  {
    q: "How many team members can I invite?",
    a: "Unlimited. Add your whole crew and your sales team — no per-seat charges, ever.",
  },
  {
    q: "What's in a Hail Impact Report?",
    a: "AI-drafted reports include the storm timeline, hail size estimates, affected property polygon, and owner contact info (Cole-enriched). Optional meteorologist review available for legal-grade claims.",
  },
  {
    q: "Do you offer annual discounts?",
    a: "Pricing shown is annual. We offer volume and multi-year discounts — contact sales for details.",
  },
  {
    q: "How accurate is the hail detection?",
    a: "We use NOAA MRMS — the same source HailTrace and Interactive Hail Maps use for real-time swaths. Hail-area accuracy is 95%+; individual size estimates carry ±0.25\" uncertainty. On-demand meteorologist review is available for critical claims.",
  },
];

function Faq() {
  return (
    <section className="bg-card border-y border-border">
      <div className="container py-20 md:py-24">
        <div className="mx-auto max-w-2xl">
          <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper text-center">
            Frequently asked
          </p>
          <h2 className="mt-3 text-center font-display text-3xl font-medium tracking-tight-display text-foreground md:text-4xl">
            The fine print, in plain English.
          </h2>
          <div className="rule-atlas mt-10" />
          <dl className="mt-10 space-y-8">
            {FAQS.map((item) => (
              <div key={item.q}>
                <dt className="font-display text-lg font-medium tracking-tight-display text-foreground">
                  {item.q}
                </dt>
                <dd className="mt-2 text-muted-foreground leading-relaxed">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-t border-border bg-primary text-primary-foreground">
      <div className="container py-16 text-center md:py-20">
        <h2 className="font-display text-balance text-3xl font-medium tracking-tight-display md:text-4xl">
          Start the trial. The next storm is already forming.
        </h2>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-md bg-copper px-5 py-3 text-sm font-medium text-primary-foreground shadow-atlas-lg transition-colors hover:bg-copper-700"
          >
            Start your free trial <span aria-hidden>→</span>
          </Link>
          <Link
            href="/compare"
            className="inline-flex items-center gap-2 rounded-md border border-primary-foreground/20 bg-transparent px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/10"
          >
            Compare to HailTrace / IHM
          </Link>
        </div>
      </div>
    </section>
  );
}

