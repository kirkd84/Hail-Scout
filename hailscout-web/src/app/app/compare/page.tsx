"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useStorms, type StormWithSwaths } from "@/hooks/useStorms";
import { hailColor } from "@/lib/hail";
import { nearestMetro } from "@/lib/metros";
import { timeAgo } from "@/lib/time-ago";
import { EmptyState } from "@/components/app/empty-state";
import { IconCompass, IconChevronRight } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { Storm } from "@/lib/api-types";

/**
 * /app/compare?a=stormA&b=stormB — side-by-side storm comparison.
 * Useful for "should we deploy crew to A or B today" decisions.
 *
 * Phase 16.8 migration: backed by /v1/storms (CONUS, last 30 days)
 * so the picker offers real cells. Both Storm A and Storm B labels
 * fall back to nearest-metro from centroid since per-cell rollups
 * don't have a "city" field. Falls back to fixtures if the API
 * returns empty.
 */
export default function ComparePage() {
  const params = useSearchParams();
  const aId = params.get("a");
  const bId = params.get("b");

  const [aPick, setAPick] = useState<string | null>(aId);
  const [bPick, setBPick] = useState<string | null>(bId);

  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const { storms } = useStorms({
    bbox: [-125, 24, -66, 50],
    from: thirtyDaysAgo,
    to: tomorrow,
    limit: 200,
    fallbackToFixtures: true,
  });

  const a = useMemo(() => storms.find((s) => s.id === aPick) ?? null, [storms, aPick]);
  const b = useMemo(() => storms.find((s) => s.id === bPick) ?? null, [storms, bPick]);

  if (!a || !b) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="container max-w-3xl py-10 space-y-8">
          <div>
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
              Storm comparison
            </p>
            <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
              Compare two storms
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick any two storms and see them side-by-side.
            </p>
          </div>
          <div className="rule-atlas" />

          <div className="grid gap-4 md:grid-cols-2">
            <Picker label="Storm A" value={aPick} onChange={setAPick} storms={storms} />
            <Picker label="Storm B" value={bPick} onChange={setBPick} storms={storms} />
          </div>

          {aPick && bPick && aPick === bPick && (
            <p className="text-sm text-destructive">Pick two different storms to compare.</p>
          )}

          {(!aPick || !bPick) && (
            <EmptyState
              icon={IconCompass}
              eyebrow="Choose two storms"
              title="Pick a Storm A and a Storm B above"
              description="We'll lay them out side-by-side with the same hail badge, AI insight, and stats so you can call the better deployment."
            />
          )}
        </div>
      </div>
    );
  }

  const aLabel = nearestMetro(a.centroid_lat, a.centroid_lng)?.label ?? "Storm A";
  const bLabel = nearestMetro(b.centroid_lat, b.centroid_lng)?.label ?? "Storm B";

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-6xl py-10 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
              Storm comparison
            </p>
            <h1 className="mt-1 font-display text-3xl font-medium tracking-tight-display text-foreground">
              {aLabel} <span className="text-foreground/35">vs</span> {bLabel}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setAPick(null);
                setBPick(null);
              }}
              className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-foreground"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="rule-atlas" />

        <Verdict a={a} b={b} aLabel={aLabel} bLabel={bLabel} />

        <div className="grid gap-6 md:grid-cols-2">
          <StormCard storm={a} side="A" />
          <StormCard storm={b} side="B" />
        </div>

        <ComparisonTable a={a} b={b} aLabel={aLabel} bLabel={bLabel} />
      </div>
    </div>
  );
}

function Picker({
  label,
  value,
  onChange,
  storms,
}: {
  label: string;
  value: string | null;
  onChange: (id: string) => void;
  storms: StormWithSwaths[];
}) {
  // Sort by start_time desc so the freshest storms surface first.
  const sorted = useMemo(
    () =>
      [...storms].sort(
        (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
      ),
    [storms],
  );
  return (
    <div>
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 mb-1.5">
        {label}
      </p>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm focus:border-copper focus:outline-none"
      >
        <option value="">— Pick a storm —</option>
        {sorted.map((s) => {
          const where = nearestMetro(s.centroid_lat, s.centroid_lng);
          return (
            <option key={s.id} value={s.id}>
              {where?.label ?? "Storm"} · {s.max_hail_size_in.toFixed(2)}″ · {timeAgo(s.start_time)}
            </option>
          );
        })}
      </select>
    </div>
  );
}

function Verdict({
  a,
  b,
  aLabel,
  bLabel,
}: {
  a: Storm;
  b: Storm;
  aLabel: string;
  bLabel: string;
}) {
  const winner =
    a.max_hail_size_in > b.max_hail_size_in
      ? "a"
      : a.max_hail_size_in < b.max_hail_size_in
      ? "b"
      : "tie";
  const winnerLabel = winner === "a" ? aLabel : winner === "b" ? bLabel : "Tie";
  const diff = Math.abs(a.max_hail_size_in - b.max_hail_size_in);

  return (
    <div className="rounded-xl border border-copper/30 bg-copper/5 p-5">
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper-700">
        HailScout · Verdict
      </p>
      <p className="mt-2 font-display text-xl font-medium tracking-tight-display text-foreground">
        {winner === "tie"
          ? "These two events are dead-even."
          : `${winnerLabel} is the bigger event.`}
      </p>
      <p className="mt-2 text-sm text-foreground/85 leading-relaxed">
        {winner === "tie"
          ? `Both peaked at ${a.max_hail_size_in.toFixed(2)}″. Pick by territory, recency, or monitored-address footprint.`
          : `Peak hail is ${diff.toFixed(2)}″ larger at ${winnerLabel}. Insurance-claim viability is materially higher at the larger event — deploy the senior crew there if you can only choose one.`}
      </p>
    </div>
  );
}

function StormCard({ storm, side }: { storm: Storm; side: "A" | "B" }) {
  const c = hailColor(storm.max_hail_size_in);
  const where = nearestMetro(storm.centroid_lat, storm.centroid_lng);
  const heavy = storm.max_hail_size_in >= 1.5;
  const badgeText = heavy ? "#FAF7F1" : c.text;
  const durHr = Math.max(
    0,
    Math.round(
      (new Date(storm.end_time).getTime() - new Date(storm.start_time).getTime()) /
        (60 * 60 * 1000),
    ),
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-atlas">
      <div className="px-5 py-4 border-b border-border bg-secondary/40 flex items-center justify-between">
        <span className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper">
          Storm {side}
        </span>
        <Link
          href={`/storm/${storm.id}`}
          className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 hover:text-copper"
        >
          Public page →
        </Link>
      </div>
      <div className="p-5">
        <p className="font-display text-2xl font-medium tracking-tight-display text-foreground">
          {where?.label ?? "United States"}
        </p>
        <p className="mt-1 font-mono-num text-xs text-foreground/55">
          {timeAgo(storm.start_time)} · {storm.source}
          {durHr > 0 && ` · ${durHr}h tracked`}
        </p>

        <div className="mt-5 flex items-center gap-4 rounded-lg p-4 ring-1 ring-foreground/10" style={{ background: `${c.solid}26` /* ~15% alpha */ }}>
          <span
            className="inline-flex h-14 w-16 flex-col items-center justify-center rounded-md ring-1 ring-foreground/20 shadow-sm"
            style={{ background: c.solid, color: badgeText }}
          >
            <span className="font-mono-num text-base font-medium leading-none">
              {storm.max_hail_size_in.toFixed(2)}″
            </span>
            <span className="text-[9px] uppercase tracking-wide-caps font-mono leading-none mt-1 opacity-90">
              {c.object}
            </span>
          </span>
          <p className="text-sm font-medium text-foreground">
            {c.label}
          </p>
        </div>

        <p className="mt-4 text-sm text-foreground/85 leading-relaxed">
          {storm.max_hail_size_in >= 2.0
            ? `Damaging hail event. ${c.object}-size hail across the swath — major roof-claim risk.`
            : storm.max_hail_size_in >= 1.0
              ? `Claim-eligible hail event. Pull addresses in this footprint for outreach.`
              : `Brief light-hail event. Surface damage unlikely on standard materials.`}
        </p>
        <p className="mt-3 text-sm font-medium text-copper-700">
          {storm.max_hail_size_in >= 1.5
            ? "Recommended: assign senior crew to this footprint first."
            : "Monitor; revisit if size estimate revises upward."}
        </p>
      </div>
    </div>
  );
}

function ComparisonTable({
  a,
  b,
  aLabel,
  bLabel,
}: {
  a: Storm;
  b: Storm;
  aLabel: string;
  bLabel: string;
}) {
  const rows: Array<{
    label: string;
    a: string | number;
    b: string | number;
    better?: "a" | "b" | "tie";
  }> = [
    {
      label: "Peak hail size",
      a: `${a.max_hail_size_in.toFixed(2)}″`,
      b: `${b.max_hail_size_in.toFixed(2)}″`,
      better:
        a.max_hail_size_in > b.max_hail_size_in
          ? "a"
          : a.max_hail_size_in < b.max_hail_size_in
          ? "b"
          : "tie",
    },
    {
      label: "Reference object",
      a: hailColor(a.max_hail_size_in).object,
      b: hailColor(b.max_hail_size_in).object,
    },
    {
      label: "Source",
      a: a.source,
      b: b.source,
    },
    {
      label: "Started",
      a: timeAgo(a.start_time),
      b: timeAgo(b.start_time),
    },
    {
      label: "Centroid",
      a: `${a.centroid_lat.toFixed(3)}, ${a.centroid_lng.toFixed(3)}`,
      b: `${b.centroid_lat.toFixed(3)}, ${b.centroid_lng.toFixed(3)}`,
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-[1.2fr_1fr_1fr] border-b border-border bg-secondary/40 text-[11px] font-mono uppercase tracking-wide-caps text-foreground/65">
        <div className="px-4 py-3">Field</div>
        <div className="px-4 py-3">{aLabel}</div>
        <div className="px-4 py-3">{bLabel}</div>
      </div>
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={cn(
            "grid grid-cols-[1.2fr_1fr_1fr] text-sm",
            i < rows.length - 1 ? "border-b border-border/60" : "",
          )}
        >
          <div className="px-4 py-3 font-medium text-foreground">{row.label}</div>
          <div className={cn("px-4 py-3 font-mono-num", row.better === "a" && "text-copper-700 font-medium bg-copper/5")}>
            {row.a}
            {row.better === "a" && <IconChevronRight className="inline-block h-3 w-3 ml-1 -rotate-90" />}
          </div>
          <div className={cn("px-4 py-3 font-mono-num", row.better === "b" && "text-copper-700 font-medium bg-copper/5")}>
            {row.b}
            {row.better === "b" && <IconChevronRight className="inline-block h-3 w-3 ml-1 -rotate-90" />}
          </div>
        </div>
      ))}
    </div>
  );
}
