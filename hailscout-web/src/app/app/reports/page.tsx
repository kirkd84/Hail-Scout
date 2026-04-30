"use client";

import Link from "next/link";
import { useReports } from "@/hooks/useReports";
import { hailColor } from "@/lib/hail";
import { timeAgo } from "@/lib/time-ago";
import { EmptyState } from "@/components/app/empty-state";
import { IconReport, IconClose, IconChevronRight } from "@/components/icons";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const { reports, remove, isLoading } = useReports();

  if (!isLoading && reports.length === 0) {
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
              Branded PDFs you generate from any storm. Saved here automatically.
            </p>
          </div>
          <div className="rule-atlas" />

          <div className="rounded-xl border border-copper/30 bg-copper/5 p-5">
            <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper-700">
              How it works
            </p>
            <ol className="mt-2 space-y-1.5 text-sm text-foreground/85">
              <li><span className="font-mono-num text-copper-700">1.</span> Open the map and search an address.</li>
              <li><span className="font-mono-num text-copper-700">2.</span> In the storm detail panel, click <strong>Download Hail Impact Report</strong>.</li>
              <li><span className="font-mono-num text-copper-700">3.</span> The PDF downloads + appears in this library for re-download anytime.</li>
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
            eyebrow="No saved reports"
            title="Generate your first report"
            description="Reports persist on every device you sign in from. Custom branding (logo, colors) coming on Pro."
            secondary={{ label: "Configure branding", href: "/app/settings" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-5xl py-10 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
              Reports
            </p>
            <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
              Hail Impact Reports
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {reports.length} report{reports.length === 1 ? "" : "s"} on file. Synced across your team.
            </p>
          </div>
          <Link
            href="/app/map"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900"
          >
            New report <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="rule-atlas" />

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[80px_2.5fr_1fr_140px_60px] border-b border-border bg-secondary/40 text-[11px] font-mono uppercase tracking-wide-caps text-foreground/65">
            <div className="px-5 py-3">Hail</div>
            <div className="px-5 py-3">Address</div>
            <div className="px-5 py-3">Storm</div>
            <div className="px-5 py-3">Generated</div>
            <div className="px-5 py-3" />
          </div>
          {reports.map((r, i) => {
            const c = r.peak_size_in ? hailColor(r.peak_size_in) : null;
            return (
              <div
                key={r.id}
                className={cn(
                  "grid grid-cols-[80px_2.5fr_1fr_140px_60px] items-center hover:bg-secondary/30 transition-colors",
                  i < reports.length - 1 ? "border-b border-border/60" : "",
                )}
              >
                <div className="px-5 py-3">
                  {c && r.peak_size_in !== null ? (
                    <span
                      className="inline-flex h-9 w-12 flex-col items-center justify-center rounded-md border"
                      style={{ background: c.bg, borderColor: c.border }}
                    >
                      <span className="font-mono-num text-xs font-medium leading-none" style={{ color: c.text }}>
                        {r.peak_size_in.toFixed(2)}″
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="px-5 py-3 min-w-0">
                  <Link
                    href={r.address ? `/app/map?address=${encodeURIComponent(r.address)}` : "/app/map"}
                    className="block truncate text-sm font-medium text-foreground hover:text-copper"
                  >
                    {r.title || r.address || "Untitled report"}
                  </Link>
                  <p className="mt-0.5 font-mono-num text-[11px] text-foreground/55">
                    {r.id}
                  </p>
                </div>
                <div className="px-5 py-3 text-sm text-foreground/85 truncate">
                  {r.storm_city || "—"}
                </div>
                <div className="px-5 py-3 text-xs text-muted-foreground">
                  {timeAgo(r.created_at)}
                </div>
                <div className="px-5 py-3 flex items-center justify-end gap-2 opacity-60 hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => void remove(r.id)}
                    aria-label="Delete report"
                    className="text-foreground/40 hover:text-destructive"
                  >
                    <IconClose className="h-3.5 w-3.5" />
                  </button>
                  <IconChevronRight className="h-4 w-4 text-foreground/30" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
