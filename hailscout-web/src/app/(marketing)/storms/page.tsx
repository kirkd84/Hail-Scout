"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { ContourBg } from "@/components/brand/contour-bg";
import { CtaBand } from "@/components/marketing/primitives";
import { useStorms } from "@/hooks/useStorms";
import { hailColor } from "@/lib/hail";
import { nearestMetro } from "@/lib/metros";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

type WindowOpt = { id: string; label: string; days: number };
const WINDOW_OPTS: WindowOpt[] = [
  { id: "7d",  label: "7 days",   days: 7 },
  { id: "30d", label: "30 days",  days: 30 },
  { id: "90d", label: "90 days",  days: 90 },
  { id: "1y",  label: "1 year",   days: 365 },
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
 * Browsable / filterable index of every cell Hail GPS has ingested,
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

      <section className="relative overflow-hidden">
        <ContourBg className="opacity-80" density="sparse" />
        <div className="container relative max-w-6xl pb-10 pt-16 md:pb-12 md:pt-20">
          <p className="eyebrow">Storm catalog · public</p>
          <h1 className="display-1 mt-3 text-foreground">
            Every storm on the map.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-[1.65] text-muted-foreground text-pretty">
            Indexed from NOAA radar. Filter by hail size, source, and time —
            open any row for the full storm record and swath map.
          </p>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40">
        <div className="container flex max-w-6xl flex-wrap items-end gap-x-6 gap-y-4 py-5">
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
        <div className="container max-w-6xl py-12 md:py-16">
          <div className="mb-5 flex items-baseline justify-between">
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps tabular-nums text-foreground/55">
              Showing {storms.length} cell{storms.length === 1 ? "" : "s"}
            </p>
            {isLoading && (
              <p className="font-mono text-[11px] uppercase tracking-wide-caps text-primary">
                Loading…
              </p>
            )}
          </div>

          {storms.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center">
              <p className="font-mono text-[11px] uppercase tracking-wide-caps text-foreground/45">
                No matches
              </p>
              <p className="mt-3 text-lg font-semibold tracking-tight text-foreground">
                No storms match these filters.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Widen the date window, drop the size threshold, or switch source.
              </p>
            </div>
          ) : (
            <StormTable storms={storms} />
          )}
        </div>
      </section>

      <CtaBand
        title="Run this on your customer list."
        lede="Hail GPS matches every saved address against every storm automatically — no manual lookups, no missed claim windows."
        primary={{ label: "Request access", href: "/request-access" }}
        secondary={{ label: "Look up an address", href: "/claim" }}
      />

      <SiteFooter />
    </main>
  );
}

/** Catalog table — mono numerals, hover rows, scrolls in its own container. */
function StormTable({
  storms,
}: {
  storms: ReturnType<typeof useStorms>["storms"];
}) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <Th>Size</Th>
            <Th>Location</Th>
            <Th className="text-right">Date</Th>
            <Th className="text-right">Age</Th>
            <Th className="text-right">Source</Th>
            <Th className="text-right">
              <span className="sr-only">Record</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {storms.map((s) => {
            const c = hailColor(s.max_hail_size_in);
            const where = nearestMetro(s.centroid_lat, s.centroid_lng);
            const heavy = s.max_hail_size_in >= 1.5;
            return (
              <tr
                key={s.id}
                onClick={() => router.push(`/storm/${s.id}`)}
                className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-secondary/40"
              >
                <td className="px-5 py-3">
                  <span
                    className="inline-flex h-11 w-14 flex-col items-center justify-center rounded-md shadow-sm ring-1 ring-foreground/15"
                    style={{ background: c.solid, color: heavy ? "#FAF7F1" : c.text }}
                  >
                    <span className="font-mono-num text-sm font-medium leading-none tabular-nums">
                      {s.max_hail_size_in.toFixed(2)}″
                    </span>
                    <span className="mt-0.5 font-mono text-[8px] uppercase leading-none tracking-wide-caps opacity-90">
                      {c.object}
                    </span>
                  </span>
                </td>
                <td className="max-w-[220px] px-5 py-3">
                  <p className="truncate font-medium text-foreground">
                    {where?.label ?? "United States"}
                  </p>
                  {where && where.miles >= 5 && where.miles <= 250 && (
                    <p className="font-mono-num text-xs tabular-nums text-muted-foreground/70">
                      {where.miles}mi from {where.metro.name}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3 text-right font-mono-num text-xs tabular-nums text-muted-foreground">
                  {new Date(s.start_time).toLocaleDateString(undefined, {
                    month: "short",
                    day: "2-digit",
                    year: "numeric",
                  })}
                </td>
                <td className="px-5 py-3 text-right font-mono-num text-xs tabular-nums text-muted-foreground">
                  {timeAgo(s.start_time)}
                </td>
                <td className="px-5 py-3 text-right font-mono text-xs uppercase tracking-wide-caps text-foreground/55">
                  {s.source}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/storm/${s.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Open <span aria-hidden>→</span>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-wide-caps text-foreground/55",
        className,
      )}
    >
      {children}
    </th>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wide-caps text-foreground/55">
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
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 items-center rounded-md px-3.5 font-mono-num text-xs font-medium tabular-nums transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-background text-foreground/75 hover:bg-card hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
