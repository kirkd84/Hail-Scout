"use client";

import Link from "next/link";
import { useTerritories, type Territory } from "@/hooks/useTerritories";
import { useMe } from "@/hooks/useMe";
import { EmptyState } from "@/components/app/empty-state";
import { IconCompass, IconClose, IconChevronRight } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";

export default function TerritoriesPage() {
  const { territories, remove, isLoading } = useTerritories();
  const { me } = useMe();
  const canManage = me?.user?.role === "owner" || me?.user?.role === "admin" || me?.user?.is_super_admin;

  if (!isLoading && territories.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="container max-w-3xl py-10">
          <EmptyState
            icon={IconCompass}
            eyebrow="Territories"
            title="No zones drawn yet"
            description="Open the map, click 'Sweep area', draw a polygon around a neighborhood, and 'Save as territory'. Assign zones to crew members so each rep knows where to canvass."
            primary={{ label: "Open the atlas", href: "/app/map" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-5xl py-10 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
              Territory zones
            </p>
            <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
              {territories.length} zone{territories.length === 1 ? "" : "s"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Polygons assigned to crew members. Drawn from the map's sweep tool.
            </p>
          </div>
          <Link
            href="/app/map"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900"
          >
            Draw a zone <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="rule-atlas" />

        <div className="grid gap-4 md:grid-cols-2">
          {isLoading && [0, 1, 2].map((i) => <SkeletonCard key={i} />)}
          {!isLoading && territories.map((t) => (
            <TerritoryCard key={t.id} territory={t} canManage={canManage} onDelete={remove} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TerritoryCard({
  territory,
  canManage,
  onDelete,
}: {
  territory: Territory;
  canManage: boolean | undefined;
  onDelete: (id: string) => void;
}) {
  const color = territory.color ?? "#0F4C5C";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-medium tracking-tight-display text-foreground truncate">
            {territory.name}
          </h3>
          <p className="mt-1 text-xs font-mono-num text-foreground/55">
            {territory.polygon.length} vertices
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete territory "${territory.name}"?`)) onDelete(territory.id);
            }}
            aria-label="Delete territory"
            className="text-foreground/40 hover:text-destructive"
          >
            <IconClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <MiniPolygonPreview polygon={territory.polygon} color={color} />

      <div className="mt-4 flex items-center justify-between text-xs">
        {territory.assignee_email ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-copper/10 px-2.5 py-1 font-mono uppercase tracking-wide-caps text-copper-700 ring-1 ring-copper/30">
            → {territory.assignee_email.split("@")[0]}
          </span>
        ) : (
          <span className="text-muted-foreground italic">Unassigned</span>
        )}
        <Link href="/app/map" className="text-copper hover:text-copper-700 inline-flex items-center gap-1">
          Open in atlas <IconChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function MiniPolygonPreview({ polygon, color }: { polygon: [number, number][]; color: string }) {
  if (polygon.length < 3) return null;
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = Math.max(1e-6, maxX - minX);
  const h = Math.max(1e-6, maxY - minY);
  // Map into a 100×60 viewBox with padding
  const proj = (x: number, y: number) => [
    8 + ((x - minX) / w) * 84,
    52 - ((y - minY) / h) * 44,
  ];
  const points = polygon.map(([x, y]) => proj(x, y).map((n) => n.toFixed(2)).join(",")).join(" ");
  return (
    <svg viewBox="0 0 100 60" className="mt-4 block w-full" style={{ aspectRatio: "100 / 60", background: "hsl(var(--cream-50))", borderRadius: 8 }}>
      <polygon
        points={points}
        fill={color}
        fillOpacity={0.12}
        stroke={color}
        strokeWidth={1.4}
      />
      {polygon.map(([x, y], i) => {
        const [px, py] = proj(x, y);
        return <circle key={i} cx={px} cy={py} r={1.2} fill={color} />;
      })}
    </svg>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="space-y-2">
        <Skeleton width="60%" height={20} />
        <Skeleton width="30%" height={10} subtle />
      </div>
      <Skeleton className="mt-4" width="100%" height={120} />
      <div className="mt-4 flex items-center justify-between">
        <Skeleton width={100} height={20} rounded="full" />
        <Skeleton width={80} height={12} subtle />
      </div>
    </div>
  );
}
