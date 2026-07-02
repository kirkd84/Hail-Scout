"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { ContourBg } from "@/components/brand/contour-bg";
import { useStorms } from "@/hooks/useStorms";
import { hailColor } from "@/lib/hail";
import { nearestMetro } from "@/lib/metros";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

type WindowOpt = { id: string; label: string; days: number };
const WINDOW_OPTS: WindowOpt[] = [
  { id: "7d",  label: "Past 7 days",   days: 7 },
  { id: "30d", label: "Past 30 days",  days: 30 },
  { id: "90d", label: "Past 90 days",  days: 90 },
  { id: "1y",  label: "Past year",     days: 365 },
];

type SizeOpt = { id: string; label: string; min: number };
const SIZE_OPTS: SizeOpt[] = [
  { id: "any",  label: "Any size", min: 0 },
  { id: "1.0",  label: "≥ 1.0″",   min: 1.0 },
  { id: "1.5",  label: "≥ 1.5″",   min: 1.5 },
  { id: "2.0",  label: "≥ 2.0″",   min: 2.0 },
  { id: "3.0",  label: "≥ 3.0″",   min: 3.0 },
];

type SrcOpt = { id: "all" | "MRMS" | "NEXRAD"; label: string };
const SRC_OPTS: SrcOpt[] = [
  { id: "all",    label: "All" },
  { id: "MRMS",   label: "MRMS" },
  { id: "NEXRAD", label: "NEXRAD" },
];

type OrderOpt = { id: "recent" | "peak"; label: string };
const ORDER_OPTS: OrderOpt[] = [
  { id: "recent", label: "Most recent" },
  { id: "peak",   label: "Biggest first" },
];

/**
 * /storms — public storm catalog.
 *
 * Browsable / filterable index of every cell HailScout has ingested,
 * across MRMS + NEXRAD. Lets prospects and shareable-link recipients
 * find specific events without signing up.
 *
 * Filters wire directly into /v1/storms query params so the API does
 * the work (no client-side filtering of large result sets).
 */
export default function StormCatalogPage() {
  const [win, setWin] = useState<WindowOpt>(WINDOW_OPTS[1]); // 30d default
  const [size, setSize] = useState<SizeOpt>(SIZE_OPTS[0]);
  const [src, setSrc] = useState<SrcOpt>(SRC_OPTS[0]);
  const [order, setOrder] = useState<OrderOpt>(ORDER_OPTS[0]);

  const from = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - win.days);
    return d.toISOString().slice(0, 10);
  }, [win]);
  const to = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const { storms, isLoading } = useStorms({
    bbox: [-125, 24, -66, 50],
    from,
    to,
    limit: 200,
    source: src.id === "all" ? null : src.id,
    minSize: size.min > 0 ? size.min : null,
    order: order.id,
    fallbackToFixtures: true,
  });

  return (
    <main className="bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden bg-topo">
        <ContourBg className="opacity-90" density="sparse" />
        <div className="container relative pb-10 pt-16 md:pb-12 md:pt-20">
          <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper">
            Storm catalog · public
          </p>
          <h1 className="mt-2 font-display text-balance text-5xl font-medium leading-[1.05] tracking-tight-display text-foreground md:text-6xl">
            Every storm on the map.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Indexed from NOAA MRMS &amp; NEXRAD. Filter by size, source, and
            time. Click any row to see the full storm record and swath map.
          </p>
        </div>
      </section>

      <section className="border-b border-border bg-card">
        <div className="container py-5 flex flex-wrap gap-4 items-end">
          <FilterGroup label="Window">
            {WINDOW_OPTS.map((o) => (
              <Chip key={o.id} active={win.id === o.id} onClick={() => setWin(o)}>
                {o.label}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Min size">
            {SIZE_OPTS.map((o) => (
              <Chip key={o.id} active={size.id === o.id} onClick={() => setSize(o)}>
                {o.label}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Source">
            {SRC_OPTS.map((o) => (
              <Chip key={o.id} active={src.id === o.id} onClick={() => setSrc(o)}>
                {o.label}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Sort">
            {ORDER_OPTS.map((o) => (
              <Chip key={o.id} active={order.id === o.id} onClick={() => setOrder(o)}>
                {o.label}
              </Chip>
            ))}
          </FilterGroup>
        </div>
      </section>

      <section className="bg-background">
        <div className="container py-10">
          <div className="mb-5 flex items-baseline justify-between">
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-foreground/55">
              Showing {storms.length} cell{storms.length === 1 ? "" : "s"}
            </p>
            {isLoading && (
              <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
                Loading…
              </p>
            )}
          </div>

          {storms.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="font-display text-2xl text-foreground">
                No storms match these filters.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Widen the date window, drop the size threshold, or switch source.
              </p>
            </div>
          ) : (
            <ul className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/60">
              {storms.map((s) => {
                const c = hailColor(s.max_hail_size_in);
                const where = nearestMetro(s.centroid_lat, s.centroid_lng);
                const heavy = s.max_hail_size_in >= 1.5;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/storm/${s.id}`}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
                    >
                      <span
                        className="inline-flex h-12 w-14 flex-col items-center justify-center rounded-md ring-1 ring-foreground/15 shadow-sm"
                        style={{ background: c.solid, color: heavy ? "#FAF7F1" : c.text }}
                      >
                        <span className="font-mono-num text-sm font-medium leading-none">
                          {s.max_hail_size_in.toFixed(2)}″
                        </span>
                        <span className="text-[8px] uppercase tracking-wide-caps font-mono leading-none mt-0.5 opacity-90">
                          {c.object}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-lg font-medium tracking-tight-display text-foreground truncate">
                          {where?.label ?? "United States"}
                          {where && where.miles >= 5 && where.miles <= 250 && (
                            <span className="font-mono-num text-xs font-normal text-muted-foreground/70 ml-1">
                              · {where.miles}mi
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs font-mono-num text-muted-foreground">
                          {new Date(s.start_time).toLocaleDateString(undefined, {
                            month: "short",
                            day: "2-digit",
                            year: "numeric",
                          })}{" "}
                          · {timeAgo(s.start_time)} · {s.source}
                        </p>
                      </div>
                      <span className="font-mono-num text-[11px] uppercase tracking-wide-caps text-foreground/40">
                        See record →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="container py-12 text-center md:py-16">
          <h2 className="font-display text-balance text-3xl font-medium tracking-tight-display md:text-4xl">
            Run this on your customer list.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            HailScout matches every saved address against every storm
            automatically — no manual lookups, no missed claim windows.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-md bg-copper px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-copper-700"
            >
              Start your free trial <span aria-hidden>→</span>
            </Link>
            <Link
              href="/claim"
              className="inline-flex items-center gap-2 rounded-md border border-primary-foreground/20 bg-transparent px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10"
            >
              Look up an address
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium font-mono-num transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-background text-foreground/75 border border-border hover:border-copper/50",
      )}
    >
      {children}
    </button>
  );
}
