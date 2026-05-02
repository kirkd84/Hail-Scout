import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { StatTicker } from "@/components/marketing/stat-ticker";
import { ContourBg } from "@/components/brand/contour-bg";

export default function ComparePage() {
  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <StatTicker />
      <Hero />
      <ComparisonGrid />
      <Verdict />
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
        <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper">Field comparison</p>
        <h1 className="mx-auto mt-3 max-w-3xl font-display text-balance text-5xl font-medium leading-[1.05] tracking-tight-display text-foreground md:text-6xl">
          The same data.
          <span className="block text-primary">A fraction of the price.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Side-by-side with HailTrace and Interactive Hail Maps. Same MRMS source. Better tooling. Built for crews.
        </p>
      </div>
    </section>
  );
}

interface CompetitorRow {
  feature: string;
  hailtrace: string | { value: string; tone?: "neutral" | "weak" };
  ihm:        string | { value: string; tone?: "neutral" | "weak" };
  hailscout:  string | { value: string; tone?: "highlight" };
}

const ROWS: CompetitorRow[] = [
  { feature: "Annual price (nationwide)", hailtrace: "$3,000 – $8,000", ihm: "$1,999", hailscout: { value: "$899", tone: "highlight" } },
  { feature: "Real-time MRMS swaths",     hailtrace: "Yes", ihm: "Yes", hailscout: "Yes" },
  { feature: "15-year historical archive", hailtrace: "Yes", ihm: "Yes", hailscout: "Yes" },
  { feature: "AI-drafted Impact Reports",  hailtrace: "—",   ihm: "—",   hailscout: { value: "Built-in", tone: "highlight" } },
  { feature: "Meteorologist review",       hailtrace: "Yes (in-house)", ihm: "Yes",  hailscout: "AI + on-demand human" },
  { feature: "iOS + Android apps",         hailtrace: "Android-leaning", ihm: "Limited", hailscout: { value: "First-class on both", tone: "highlight" } },
  { feature: "Per-seat pricing",           hailtrace: "Yes", ihm: "Yes", hailscout: { value: "Unlimited seats", tone: "highlight" } },
  { feature: "API for CRM integrations",   hailtrace: "—",   ihm: "Limited", hailscout: { value: "API-first", tone: "highlight" } },
  { feature: "Team / multi-tenant",        hailtrace: "Add-on", ihm: "Limited", hailscout: { value: "Built-in", tone: "highlight" } },
  { feature: "Free trial",                 hailtrace: "Demo only", ihm: "Demo only", hailscout: { value: "14-day full access", tone: "highlight" } },
];

function ComparisonGrid() {
  return (
    <section className="bg-background">
      <div className="container py-16 md:py-24">
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-atlas">
          <div className="grid grid-cols-[2fr_1fr_1fr_1.2fr] border-b border-border bg-secondary/40">
            <ColHead>Feature</ColHead>
            <ColHead>HailTrace</ColHead>
            <ColHead>IHM</ColHead>
            <ColHead highlight>HailScout</ColHead>
          </div>
          {ROWS.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-[2fr_1fr_1fr_1.2fr] ${i < ROWS.length - 1 ? "border-b border-border/60" : ""}`}
            >
              <Cell label>{row.feature}</Cell>
              <Cell>{cellText(row.hailtrace)}</Cell>
              <Cell>{cellText(row.ihm)}</Cell>
              <Cell highlight>{cellText(row.hailscout)}</Cell>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Pricing reflects publicly listed plans as of April 2026. Contact each provider for negotiated rates.
        </p>
      </div>
    </section>
  );
}

function ColHead({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div
      className={`px-5 py-4 font-mono text-[11px] uppercase tracking-wide-caps ${
        highlight ? "text-copper" : "text-foreground/65"
      }`}
    >
      {children}
    </div>
  );
}

function Cell({
  children,
  label,
  highlight,
}: {
  children: React.ReactNode;
  label?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`px-5 py-4 text-sm ${
        label
          ? "font-medium text-foreground"
          : highlight
          ? "bg-copper/5 text-foreground"
          : "text-foreground/85"
      }`}
    >
      {children}
    </div>
  );
}

type CellValue = CompetitorRow["hailtrace"] | CompetitorRow["ihm"] | CompetitorRow["hailscout"];

function cellText(v: CellValue): React.ReactNode {
  if (typeof v === "string") {
    if (v === "—") return <span className="text-muted-foreground">—</span>;
    return v;
  }
  if (v.tone === "highlight") {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-copper">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
          <path d="M3 8.5L6.5 12L13 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {v.value}
      </span>
    );
  }
  return v.value;
}

function Verdict() {
  return (
    <section className="bg-card border-y border-border">
      <div className="container py-20 md:py-24">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper">Why HailScout</p>
            <h3 className="mt-3 font-display text-3xl font-medium tracking-tight-display text-foreground">
              We bet the company on three things.
            </h3>
            <ul className="mt-6 space-y-4 text-foreground/85">
              {[
                ["A flat, fair price.", "$899/yr for the whole crew, the whole country."],
                ["A polished mobile experience.", "iOS and Android, both first-class."],
                ["Reports that close deals.", "Branded Hail Impact Reports in seconds."],
              ].map(([title, body]) => (
                <li key={title} className="flex gap-4 items-start">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-copper" />
                  <div>
                    <p className="font-medium text-foreground">{title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-mono-num text-xs uppercase tracking-wide-caps text-foreground/55">Honest take</p>
            <h3 className="mt-3 font-display text-3xl font-medium tracking-tight-display text-foreground">
              What the others do well.
            </h3>
            <div className="mt-6 space-y-5 text-sm text-muted-foreground leading-relaxed">
              <p>
                <span className="font-medium text-foreground">HailTrace ($3–8K/yr):</span> The
                established name. Deep relationships at large national contractors. Strong
                Android app. Worth the price if you've already built workflows around them.
              </p>
              <p>
                <span className="font-medium text-foreground">Interactive Hail Maps ($1,999/yr):</span>
                Solid value at their price. The data quality is real. Limitations show up in
                the mobile experience and integration story.
              </p>
              <p>
                <span className="font-medium text-foreground">When NOT to switch to HailScout:</span>
                You have a deeply entrenched workflow with one of the above and your team is
                resistant to change. We'd rather you stay than churn.
              </p>
            </div>
          </div>
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
          Try the atlas. Decide for yourself.
        </h2>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-md bg-copper px-5 py-3 text-sm font-medium text-primary-foreground shadow-atlas-lg transition-colors hover:bg-copper-700">
            Start your free trial <span aria-hidden>→</span>
          </Link>
          <Link href="/pricing" className="inline-flex items-center gap-2 rounded-md border border-primary-foreground/20 bg-transparent px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/10">
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

