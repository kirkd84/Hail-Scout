"use client";

import Link from "next/link";
import { useSavedAddresses } from "@/hooks/useSavedAddresses";
import { hailColor } from "@/lib/hail";
import { EmptyState } from "@/components/app/empty-state";
import { IconAddresses, IconChevronRight } from "@/components/icons";
import { cn } from "@/lib/utils";

export default function AddressesPage() {
  const { addresses, remove } = useSavedAddresses();

  if (addresses.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="container max-w-3xl py-10">
          <EmptyState
            icon={IconAddresses}
            eyebrow="Monitored addresses"
            title="No saved addresses yet."
            description="Search any address on the map and click ‘Monitor address’ to save it. Come back here every morning to see what hit your customers overnight."
            primary={{ label: "Search the atlas", href: "/app/map" }}
          />
        </div>
      </div>
    );
  }

  // Sort: most-recent storm at the top, then alphabetical
  const sorted = [...addresses].sort((a, b) => {
    const ta = a.last_storm_at ? new Date(a.last_storm_at).getTime() : 0;
    const tb = b.last_storm_at ? new Date(b.last_storm_at).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return a.address.localeCompare(b.address);
  });

  // KPI counts
  const total = addresses.length;
  const recent = addresses.filter(
    (a) =>
      a.last_storm_at &&
      Date.now() - new Date(a.last_storm_at).getTime() < 30 * 24 * 60 * 60 * 1000,
  ).length;
  const big = addresses.filter((a) => (a.last_storm_size_in ?? 0) >= 1.75).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-5xl py-10 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
              Atlas watchlist
            </p>
            <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
              Monitored addresses
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {total} address{total === 1 ? "" : "es"} on your watchlist. Stored locally on this device.
            </p>
          </div>
          <Link
            href="/app/map"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900"
          >
            Add from map <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="rule-atlas" />

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total monitored" value={total.toString()} />
          <Stat label="Hit in last 30 days" value={recent.toString()} accent />
          <Stat label="With ≥ 1.75&Prime; hail" value={big.toString()} accent />
        </div>

        {/* List */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[3fr_1fr_140px_60px] border-b border-border bg-secondary/40 text-[11px] font-mono uppercase tracking-wide-caps text-foreground/65">
            <div className="px-5 py-3">Address</div>
            <div className="px-5 py-3">Last hail</div>
            <div className="px-5 py-3">Last hit</div>
            <div className="px-5 py-3" />
          </div>
          {sorted.map((a, i) => {
            const c = a.last_storm_size_in ? hailColor(a.last_storm_size_in) : null;
            const lastHitDate = a.last_storm_at
              ? new Date(a.last_storm_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—";
            return (
              <Link
                key={a.id}
                href={`/app/map?address=${encodeURIComponent(a.address)}`}
                className={cn(
                  "grid grid-cols-[3fr_1fr_140px_60px] items-center hover:bg-secondary/30 transition-colors",
                  i < sorted.length - 1 ? "border-b border-border/60" : "",
                )}
              >
                <div className="px-5 py-4">
                  <p className="font-medium text-foreground truncate">
                    {a.label || a.address}
                  </p>
                  {a.label && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{a.address}</p>
                  )}
                  <p className="font-mono-num text-[11px] text-foreground/55 mt-0.5">
                    {a.lat.toFixed(4)}, {Math.abs(a.lng).toFixed(4)}
                  </p>
                </div>
                <div className="px-5 py-4">
                  {c && a.last_storm_size_in !== undefined ? (
                    <div
                      className="inline-flex flex-col items-center justify-center rounded-md border px-2.5 py-1"
                      style={{ background: c.bg, borderColor: c.border }}
                    >
                      <span
                        className="font-mono-num text-sm font-medium leading-none"
                        style={{ color: c.text }}
                      >
                        {a.last_storm_size_in.toFixed(2)}″
                      </span>
                      <span
                        className="text-[9px] uppercase tracking-wide-caps font-mono leading-none mt-0.5"
                        style={{ color: c.text, opacity: 0.75 }}
                      >
                        {c.object}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">No data</span>
                  )}
                </div>
                <div className="px-5 py-4 text-sm text-muted-foreground">{lastHitDate}</div>
                <div className="px-5 py-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      remove(a.id);
                    }}
                    className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/40 hover:text-destructive"
                  >
                    Remove
                  </button>
                  <IconChevronRight className="h-4 w-4 text-foreground/30" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55">
        <span dangerouslySetInnerHTML={{ __html: label }} />
      </p>
      <p
        className={cn(
          "mt-1 font-display text-3xl font-medium tracking-tight-display",
          accent ? "text-copper" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
