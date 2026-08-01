import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { CtaBand, MarketingCard, SectionHeading } from "@/components/marketing/primitives";
import { StatTicker } from "@/components/marketing/stat-ticker";
import { ContourBg } from "@/components/brand/contour-bg";
import { AtlasMapPreview } from "@/components/brand/atlas-map-preview";
import { RoiCalculator } from "@/components/marketing/roi-calculator";
import { HailOutlook } from "@/components/marketing/hail-outlook";
import { LiveCountBadge } from "@/components/marketing/live-count-badge";
import { CrewUseCases } from "@/components/marketing/testimonial-carousel";
import { LandingFaq } from "@/components/marketing/landing-faq";

/**
 * Hail GPS marketing landing — "Storm Instrument".
 *
 * The site reads like the product: a precision instrument for reading
 * storms. Always-dark hero plate (the product map is dark in both
 * themes), mono readouts for anything numeric, one cyan accent, and the
 * warm hail ramp appearing only as data.
 *
 * Section grounds alternate bg → secondary/40 → bg:
 *   Hero (always-dark) → How it works (bg) → Live outlook (secondary)
 *   → ROI (bg) → Use cases (secondary) → FAQ (bg) → CtaBand.
 *
 * Honesty: every number on this page is either live from the public API
 * (stat ticker, live cell count, SPC outlook) or a product capability —
 * no invented customer stats, no fake timestamps, no fabricated quotes.
 */
export default function HomePage() {
  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <StatTicker />
      <Hero />
      <HowItWorks />
      <HailOutlook />
      <RoiCalculator />
      <CrewUseCases />
      <LandingFaq />
      <CtaBand
        title="The next storm won't wait."
        lede="Request access and your crew is on the map — we onboard your team directly, set up in a day."
        primary={{ label: "Request access", href: "/request-access" }}
        secondary={{ label: "See the live map", href: "/live" }}
      />
      <SiteFooter />
    </main>
  );
}

/* ──────────────────────────────────────────────────────────
   Hero — always-dark instrument plate.
   Mode-invariant inks (cream/teal/copper ramps) so it reads
   like the product map in light mode too.
   ────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden bg-teal-900">
      <ContourBg className="text-cream-50 opacity-50" density="normal" />
      <div className="container relative max-w-6xl">
        <div className="grid gap-12 pb-16 pt-16 md:pt-24 lg:grid-cols-12 lg:items-center lg:gap-16">
          <div className="animate-fade-up lg:col-span-6">
            <LiveCountBadge className="mb-6" />
            <h1 className="display-1 text-cream-50">
              Every hailstorm,
              <span className="block text-copper-300">on one map.</span>
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-[1.65] text-teal-200/90">
              Hail GPS shows your crew where it hailed, how big it got, and
              which roofs to knock — minutes after the storm, at any address.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/request-access"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-copper-700"
              >
                Request access <span aria-hidden>→</span>
              </Link>
              <Link
                href="/live"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-cream-50/25 px-5 text-sm font-medium text-cream-50 transition-colors hover:bg-cream-50/10"
              >
                See the live map
              </Link>
            </div>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-cream-50/40">
              NOAA weather radar · address-level · no meteorology degree required
            </p>
          </div>

          <div className="animate-fade-up lg:col-span-6" style={{ animationDelay: "120ms" }}>
            <AtlasMapPreview />
            <div className="mt-3 flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.14em] text-cream-50/40">
              <span className="font-mono-num">35.47°N 97.52°W · OKC metro</span>
              <span>Sample plate · real size ramp</span>
            </div>
          </div>
        </div>

        <SpecStrip />
      </div>
    </section>
  );
}

/* Instrument spec strip — product capabilities, not performance claims. */
function SpecStrip() {
  const specs = [
    { v: "2 min", k: "from radar to your map" },
    { v: "1 mi²", k: "swath detail — NOAA weather radar" },
    { v: "2021", k: "hail history back to, at any address" },
    { v: "48", k: "states covered, coast to coast" },
  ];
  return (
    <div className="relative grid grid-cols-2 gap-x-6 gap-y-8 border-t border-cream-50/10 py-10 md:grid-cols-4">
      {specs.map((s) => (
        <div key={s.k}>
          <p className="font-mono-num text-2xl font-medium text-cream-50 md:text-3xl">
            {s.v}
          </p>
          <p className="mt-1 text-sm leading-snug text-cream-50/55">{s.k}</p>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   How it works — three genuinely sequential steps, so the
   mono numerals mean something.
   ────────────────────────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "We watch the sky",
      body:
        "Hail GPS reads NOAA storm radar around the clock. When hail starts falling, the swath shows up on your map within minutes — while the storm is still moving.",
    },
    {
      n: "02",
      title: "You see every hit address",
      body:
        "Zoom into the neighborhood, tap any roof, and read the hail size at that exact address — today's storm or anything in the archive back to 2021.",
    },
    {
      n: "03",
      title: "Your crew knocks first",
      body:
        "Export the streets worth working and hand every homeowner a branded report with the storm date and hail size for their address.",
    },
  ];
  return (
    <section id="how" className="bg-background">
      <div className="container max-w-6xl py-24 md:py-32">
        <SectionHeading
          eyebrow="How it works"
          title="From radar echo to knocked door."
          lede="No radar training, no jargon. The pipeline does the meteorology; your crew gets streets and hail sizes."
        />
        <div className="mt-10 grid gap-5 md:mt-12 md:grid-cols-3">
          {steps.map((s) => (
            <MarketingCard key={s.n} className="p-7">
              <p className="font-mono-num text-xs text-primary">{s.n}</p>
              <h3 className="mt-3 text-xl font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-base leading-[1.65] text-muted-foreground">{s.body}</p>
            </MarketingCard>
          ))}
        </div>
      </div>
    </section>
  );
}
