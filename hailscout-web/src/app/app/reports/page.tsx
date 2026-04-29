import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { IconReport } from "@/components/icons";

export default function ReportsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-3xl py-10 space-y-6">
        <div>
          <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
            Reports
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
            Hail Impact Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Branded PDFs you can hand to a homeowner. Generate them from any storm
            on the map.
          </p>
        </div>
        <div className="rule-atlas" />

        <div className="rounded-xl border border-copper/30 bg-copper/5 p-5">
          <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper-700">
            How it works
          </p>
          <ol className="mt-2 space-y-1.5 text-sm text-foreground/85">
            <li>
              <span className="font-mono-num text-copper-700">1.</span> Open the map
              and search an address (or click a storm on the atlas).
            </li>
            <li>
              <span className="font-mono-num text-copper-700">2.</span> In the storm
              detail panel, click <strong>Download Hail Impact Report</strong>.
            </li>
            <li>
              <span className="font-mono-num text-copper-700">3.</span> A branded PDF
              downloads to your device. Hand it to the homeowner or attach to a claim.
            </li>
          </ol>
          <Link
            href="/app/map"
            className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900"
          >
            Open the atlas <span aria-hidden>→</span>
          </Link>
        </div>

        <EmptyState
          icon={IconReport}
          eyebrow="Coming soon"
          title="Saved reports library"
          description="Sign-in-synced report history with re-download, custom branding (logos, colors), and on-demand meteorologist review for legal-grade claims."
          secondary={{ label: "Talk to us", href: "mailto:hello@hailscout.com" }}
        />
      </div>
    </div>
  );
}
