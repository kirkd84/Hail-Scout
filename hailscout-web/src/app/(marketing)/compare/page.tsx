import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { SectionHeading, CtaBand } from "@/components/marketing/primitives";
import { ContourBg } from "@/components/brand/contour-bg";

export const metadata: Metadata = {
  title: "Compare",
  description:
    "Hail GPS next to the established hail-mapping tools — feature by feature, with only claims you can check.",
};

/**
 * /compare — field comparison.
 *
 * Honesty rules for this page: every Hail GPS cell describes a shipped
 * feature; competitor cells are only marked when the capability is
 * publicly documented by that vendor; "—" means "not documented
 * publicly — ask them", never "they don't have it". No competitor
 * dollar figures anywhere.
 */
export default function ComparePage() {
  return (
    <main className="bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <ComparisonTable />
      <Verdict />
      <CtaBand
        title="Try the map. Decide for yourself."
        lede="Request access and check your own storm history — every claim on this page is testable from the product."
        primary={{ label: "Request access", href: "/request-access" }}
        secondary={{ label: "See pricing", href: "/pricing" }}
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
        <p className="eyebrow">Field comparison</p>
        <h1 className="display-1 mx-auto mt-4 max-w-3xl text-foreground">
          Same storms.
          <span className="block text-primary">Different instrument.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-prose text-base leading-[1.65] text-muted-foreground">
          Hail GPS next to HailTrace and Interactive Hail Maps — feature by
          feature. We only mark a competitor cell when their own public
          materials document it.
        </p>
      </div>
    </section>
  );
}

/** Cell values: check = documented yes; text = a specific readout; null = not publicly documented. */
type Cell = { check: true; note?: string } | { text: string; mono?: boolean } | null;

interface Row {
  feature: string;
  hailgps: Cell;
  hailtrace: Cell;
  ihm: Cell;
}

const ROWS: Row[] = [
  {
    feature: "Live nationwide hail map",
    hailgps: { check: true, note: "new data ~every 2 min during a storm" },
    hailtrace: { check: true },
    ihm: { check: true },
  },
  {
    feature: "Hail history at an exact address",
    hailgps: { check: true },
    hailtrace: { check: true },
    ihm: { check: true },
  },
  {
    feature: "Storm archive with date search",
    hailgps: { check: true, note: "back to 2021" },
    hailtrace: { check: true },
    ihm: { check: true },
  },
  {
    feature: "Live radar loop",
    hailgps: { check: true, note: "new" },
    hailtrace: null,
    ihm: null,
  },
  {
    feature: "Morning heads-up when hail is forecast",
    hailgps: { check: true, note: "new" },
    hailtrace: null,
    ihm: null,
  },
  {
    feature: "Storm alerts on your saved areas",
    hailgps: { check: true, note: "email · text · Slack · phone" },
    hailtrace: { check: true },
    ihm: { check: true },
  },
  {
    feature: "Ground hail reports layered in",
    hailgps: { check: true },
    hailtrace: null,
    ihm: null,
  },
  {
    feature: "Canvassing pins for the whole crew",
    hailgps: { check: true },
    hailtrace: null,
    ihm: null,
  },
  {
    feature: "Public API — no key required",
    hailgps: { check: true },
    hailtrace: null,
    ihm: null,
  },
  {
    feature: "Unlimited team members, flat price",
    hailgps: { check: true },
    hailtrace: null,
    ihm: null,
  },
  {
    feature: "Published pricing",
    hailgps: { text: "$899/yr", mono: true },
    hailtrace: null,
    ihm: null,
  },
];

function ComparisonTable() {
  return (
    <section className="py-24 md:py-32">
      <div className="container max-w-6xl">
        <SectionHeading
          eyebrow="Side by side"
          title="Only claims you can check."
          lede="Every Hail GPS row is a shipped feature you can test the day you get access."
        />

        <div className="mt-12 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left">
                <th scope="col" className="px-5 py-4 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Feature
                </th>
                <th scope="col" className="px-5 py-4 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-primary">
                  Hail GPS
                </th>
                <th scope="col" className="px-5 py-4 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  HailTrace
                </th>
                <th scope="col" className="px-5 py-4 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  IHM
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`transition-colors hover:bg-secondary/40 ${
                    i < ROWS.length - 1 ? "border-b border-border/60" : ""
                  }`}
                >
                  <th scope="row" className="px-5 py-4 text-left font-medium text-foreground">
                    {row.feature}
                  </th>
                  <td className="bg-primary/5 px-5 py-4">
                    <CellView cell={row.hailgps} highlight />
                  </td>
                  <td className="px-5 py-4">
                    <CellView cell={row.hailtrace} />
                  </td>
                  <td className="px-5 py-4">
                    <CellView cell={row.ihm} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 max-w-prose text-xs leading-relaxed text-muted-foreground">
          Competitor cells are marked only for capabilities those vendors
          publicly advertise. &ldquo;—&rdquo; means not publicly documented as
          far as we know — ask the vendor directly, and tell us if we got one
          wrong. We don&apos;t print competitor prices we can&apos;t verify;
          ours is published above.
        </p>
      </div>
    </section>
  );
}

function CellView({ cell, highlight }: { cell: Cell; highlight?: boolean }) {
  if (cell === null) {
    return <span className="text-muted-foreground/70">—</span>;
  }
  if ("text" in cell) {
    return (
      <span
        className={`${cell.mono ? "font-mono-num tabular-nums " : ""}font-medium ${
          highlight ? "text-primary" : "text-foreground/85"
        }`}
      >
        {cell.text}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-start gap-1.5 ${highlight ? "text-primary" : "text-foreground/85"}`}>
      <svg viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden>
        <path
          d="M3 8.5L6.5 12L13 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        <span className="sr-only">Yes</span>
        {cell.note && (
          <span className={`font-mono text-[11px] ${highlight ? "text-primary/80" : "text-muted-foreground"}`}>
            {cell.note}
          </span>
        )}
      </span>
    </span>
  );
}

function Verdict() {
  return (
    <section className="border-y border-border bg-secondary/40 py-24 md:py-32">
      <div className="container max-w-6xl">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <p className="eyebrow">Why Hail GPS</p>
            <h2 className="display-2 mt-3 text-foreground">
              We bet the company on three things.
            </h2>
            <ul className="mt-8 space-y-5">
              {[
                ["A flat, published price.", "$899/yr for the whole crew, the whole country. No quote call."],
                ["An honest map.", "Radar-derived sizes checked against ground reports, with the accuracy numbers published."],
                ["The whole storm day.", "Forecast heads-up in the morning, live radar during, alerts the moment it lands, pins for the week after."],
              ].map(([title, body]) => (
                <li key={title} className="flex items-start gap-4">
                  <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="font-semibold text-foreground">{title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Honest take</p>
            <h2 className="display-2 mt-3 text-foreground">
              What the others do well.
            </h2>
            <div className="mt-8 max-w-prose space-y-5 text-sm leading-[1.65] text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">HailTrace:</span>{" "}
                the established name, with deep relationships at large national
                contractors and an in-house meteorology team. If you&apos;ve
                already built your workflows around them, that&apos;s worth
                something real.
              </p>
              <p>
                <span className="font-semibold text-foreground">Interactive Hail Maps:</span>{" "}
                a long-running product with a loyal base. The underlying data
                quality is real.
              </p>
              <p>
                <span className="font-semibold text-foreground">When NOT to switch to Hail GPS:</span>{" "}
                your team has a deeply entrenched workflow with one of the above
                and resents change. We&apos;d rather you stay put than churn.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
