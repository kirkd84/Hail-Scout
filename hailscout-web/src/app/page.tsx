import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ContourBg } from "@/components/brand/contour-bg";
import { AtlasMapPreview } from "@/components/brand/atlas-map-preview";
import { RoiCalculator } from "@/components/marketing/roi-calculator";
import { LiveCountBadge } from "@/components/marketing/live-count-badge";

/**
 * HailScout marketing landing.
 *
 * Direction: Topographic (cream + deep teal + copper).
 * Tone: editorial / field guide / cartographer authority.
 * Hierarchy borrowed from Apple product pages — generous whitespace,
 * one idea per fold, type as the hero, motion only where it earns it.
 */
export default function HomePage() {
  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <Numbers />
      <HowItWorks />
      <ProductSections />
      <RoiCalculator />
      <Testimonial />
      <FinalCta />
      <SiteFooter />
    </main>
  );
}

/* ──────────────────────────────────────────────────────────
   Header
   ────────────────────────────────────────────────────────── */
function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Wordmark size="md" pulse />
        <nav className="hidden items-center gap-8 md:flex">
          <Link href="/#how" className="text-sm text-muted-foreground transition-colors hover:text-foreground">How it works</Link>
          <Link href="/live" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Live storms</Link>
          <Link href="/claim" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Claim lookup</Link>
          <Link href="/pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Pricing</Link>
          <Link href="/compare" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Compare</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas transition-colors hover:bg-teal-900"
          >
            Start free trial
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────────────────
   Hero
   ────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden bg-topo">
      <ContourBg className="opacity-90" density="normal" />
      <div className="container relative grid gap-12 pb-24 pt-16 md:gap-16 md:pb-32 md:pt-24 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-6 animate-fade-up">
          <LiveCountBadge className="mb-5" />
          <h1 className="font-display text-balance text-5xl font-medium leading-[1.02] tracking-tight-display text-foreground md:text-6xl lg:text-7xl">
            Every hailstorm,
            <span className="block text-primary">on one atlas.</span>
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl">
            HailScout is the field guide your crew opens every morning. Track
            real-time hail swaths, fifteen years of history, and every address
            worth a knock — before your competition does.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-atlas transition-all hover:bg-teal-900"
            >
              Start your free trial <span aria-hidden>→</span>
            </Link>
            <Link
              href="#how"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              See how it works
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            No credit card required. Cancel anytime.
          </p>
        </div>

        <div className="relative lg:col-span-6 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <AtlasMapPreview />
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono-num">PLATE 03 · DFW–OKC–ICT corridor</span>
            <span className="font-mono-num">UPDATED 04/26 · 19:42 UTC</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
   Trust numbers — small "stat" row in atlas style
   ────────────────────────────────────────────────────────── */
function Numbers() {
  const stats = [
    { v: "15 yrs", k: "of hail history, every address" },
    { v: "2 min",  k: "from impact to your map" },
    { v: "1 mi²", k: "swath resolution, NOAA MRMS" },
    { v: "48 st",  k: "continental coverage" },
  ];
  return (
    <section className="border-y border-border bg-card">
      <div className="container grid grid-cols-2 gap-8 py-10 md:grid-cols-4 md:py-12">
        {stats.map((s) => (
          <div key={s.k} className="flex flex-col gap-1">
            <span className="font-display text-3xl font-medium tracking-tight-display text-primary md:text-4xl">{s.v}</span>
            <span className="text-sm text-muted-foreground">{s.k}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
   How it works — three editorial steps
   ────────────────────────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "We watch the sky.",
      body:
        "Our pipeline ingests NOAA MRMS data every two minutes. The moment hail-bearing radar signatures cross a populated area, the swath appears on your atlas.",
    },
    {
      n: "02",
      title: "You see the opportunity.",
      body:
        "Open the map. Every storm, every address. Drop a pin, search a neighborhood, export a list of addresses with documented hail of any size.",
    },
    {
      n: "03",
      title: "Your crew arrives first.",
      body:
        "Branded Hail Impact Reports generate in seconds. Your sales team rolls with proof. Insurance adjusters trust the source. You close before anyone else has parked.",
    },
  ];
  return (
    <section id="how" className="bg-background">
      <div className="container py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper">How it works</p>
          <h2 className="mt-3 font-display text-4xl font-medium tracking-tight-display text-foreground md:text-5xl">
            From radar to roof in three steps.
          </h2>
        </div>
        <div className="rule-atlas mx-auto mt-12 max-w-5xl" />
        <div className="mt-16 grid gap-12 md:grid-cols-3">
          {steps.map((s, i) => (
            <article key={s.n} className="group relative animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="font-mono-num text-xs text-copper">{s.n}</div>
              <h3 className="mt-2 font-display text-2xl font-medium tracking-tight-display text-foreground">{s.title}</h3>
              <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
   Product sections — alternating image/text editorial layouts
   ────────────────────────────────────────────────────────── */
function ProductSections() {
  return (
    <section className="bg-card">
      <div className="container space-y-24 py-24 md:space-y-32 md:py-32">
        <ProductRow
          flip={false}
          eyebrow="Real-time + 15-year archive"
          title="The whole sky, on one page."
          body="Every storm we've ever indexed lives on the atlas. Filter by date, by hail size, by address. The interface gets out of the way — the map is the product."
          stat={{ value: "1,200+", label: "storms indexed last quarter" }}
        />
        <ProductRow
          flip
          eyebrow="Reports that close deals"
          title="Hail Impact Reports, in seconds."
          body="A polished, branded PDF for every address. Hail size, swath polygon, dates, satellite proof links. Your customer doesn't have to take your word — the report does."
          stat={{ value: "< 6 sec", label: "median report generation" }}
        />
        <ProductRow
          flip={false}
          eyebrow="Built for your team"
          title="Multi-tenant by default."
          body="One workspace per company. Crews, sales, ops — each with the right access. Add a teammate in 30 seconds. Scale across territories without re-architecting your stack."
          stat={{ value: "Unlimited", label: "seats per workspace" }}
        />
      </div>
    </section>
  );
}

function ProductRow({
  eyebrow,
  title,
  body,
  stat,
  flip,
}: {
  eyebrow: string;
  title: string;
  body: string;
  stat: { value: string; label: string };
  flip: boolean;
}) {
  return (
    <div className="grid items-center gap-10 md:grid-cols-12 md:gap-16">
      <div className={`md:col-span-6 ${flip ? "md:order-2" : ""}`}>
        <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper">{eyebrow}</p>
        <h3 className="mt-3 font-display text-3xl font-medium tracking-tight-display text-foreground md:text-4xl">{title}</h3>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground md:text-lg">{body}</p>
        <div className="mt-8 inline-flex items-baseline gap-3 border-l-2 border-copper pl-4">
          <span className="font-display text-3xl font-medium tracking-tight-display text-primary">{stat.value}</span>
          <span className="text-sm text-muted-foreground">{stat.label}</span>
        </div>
      </div>
      <div className={`md:col-span-6 ${flip ? "md:order-1" : ""}`}>
        <AtlasMapPreview />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Testimonial — single editorial pull-quote
   ────────────────────────────────────────────────────────── */
function Testimonial() {
  return (
    <section className="bg-background">
      <div className="container py-24 md:py-32">
        <figure className="mx-auto max-w-3xl text-center">
          <blockquote className="font-display text-balance text-3xl font-medium leading-snug tracking-tight-display text-foreground md:text-4xl">
            &ldquo;HailScout is the difference between us showing up first and us
            showing up at all. Our team rolls before the storm passes.&rdquo;
          </blockquote>
          <figcaption className="mt-8 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Marcus Holloway</span> — Owner, Holloway Roofing · Wichita, KS
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
   Final CTA — full-bleed copper accent
   ────────────────────────────────────────────────────────── */
function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-border bg-primary text-primary-foreground">
      <div className="container relative py-20 text-center md:py-28">
        <h2 className="font-display text-balance text-4xl font-medium tracking-tight-display md:text-5xl">
          The next storm is already forming.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-primary-foreground/80">
          Start your trial. Be ready before it hits.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-md bg-copper px-6 py-3 text-sm font-medium text-primary-foreground shadow-atlas-lg transition-colors hover:bg-copper-700"
          >
            Start your free trial <span aria-hidden>→</span>
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-md border border-primary-foreground/20 bg-transparent px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/10"
          >
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
   Footer
   ────────────────────────────────────────────────────────── */
function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-12">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <Wordmark size="sm" />
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/live" className="hover:text-foreground">Live storms</Link>
            <Link href="/claim" className="hover:text-foreground">Claim lookup</Link>
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/compare" className="hover:text-foreground">Compare</Link>
            <Link href="/sign-in" className="hover:text-foreground">Sign in</Link>
            <a href="mailto:hello@hailscout.com" className="hover:text-foreground">Contact</a>
          </nav>
        </div>
        <div className="rule-atlas mt-8" />
        <p className="mt-8 text-xs text-muted-foreground">
          &copy; 2026 HailScout. Storm data via NOAA MRMS. Built for crews who beat the clock.
        </p>
      </div>
    </footer>
  );
}
