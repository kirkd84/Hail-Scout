"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import type { Map as MapLibreMap, MapMouseEvent, GeoJSONSource } from "maplibre-gl";
import { useMarkers } from "@/hooks/useMarkers";
import { useTerritories } from "@/hooks/useTerritories";
import { useTeam } from "@/hooks/useTeam";
import { useAuth } from "@/hooks/useAuth";
import { apiClient, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { IconClose } from "@/components/icons";

const SOURCE_ID  = "hs-sweep-poly";
const FILL_LAYER = "hs-sweep-fill";
const LINE_LAYER = "hs-sweep-line";
const VTX_LAYER  = "hs-sweep-vtx";

type Mode = "off" | "drawing" | "ready" | "dropping";
type Bucket = "all" | "residential" | "commercial" | "land" | "other";

interface Parcel {
  id: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  full_address: string | null;
  owner_name: string | null;
  owner_mailing_address: string | null;
  property_type: string;
  property_type_raw: string | null;
  year_built: number | null;
  building_sqft: number | null;
  assessed_value: number | null;
  market_value: number | null;
  last_sold_at: string | null;
  lat: number | null;
  lng: number | null;
}

interface InPolygonResponse {
  parcels: Parcel[];
  count: number;
  property_type: string;
}

interface Props {
  map: MapLibreMap | null;
  /** Hide the built-in "Sweep area" pill — the Tools menu triggers it
   *  externally via `startSignal` instead. */
  hideTrigger?: boolean;
  /** Bump this number (e.g. from the Tools menu) to start drawing. */
  startSignal?: number;
}

/**
 * "Sweep this area" — draw a polygon, then pull every real property parcel
 * inside it (via /v1/parcels/in-polygon → Parcel-Service). Filter by land use
 * (commercial / residential), export the list to CSV, or drop the leads as
 * canvassing markers. The polygon can also be saved as a named territory.
 *
 * Keyboard: Esc cancels drawing. Enter closes the polygon (or click the start
 * vertex).
 */
export function SweepTool({ map, hideTrigger = false, startSignal = 0 }: Props) {
  const [mode, setMode] = useState<Mode>("off");
  const [pts, setPts] = useState<[number, number][]>([]);
  const ptsRef = useRef<[number, number][]>([]);
  ptsRef.current = pts;
  const { add } = useMarkers();
  const { create: createTerritory } = useTerritories();
  const { members } = useTeam();
  const { getToken } = useAuth();
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveAssignee, setSaveAssignee] = useState<string>("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Lead-list state.
  const [leads, setLeads] = useState<Parcel[] | null>(null);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<Bucket>("all");

  // Set up the source/layers on mount
  useEffect(() => {
    if (!map) return;

    const setup = () => {
      if (map.getSource(SOURCE_ID)) return;
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: FILL_LAYER,
        type: "fill",
        source: SOURCE_ID,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#06B6D4", "fill-opacity": 0.10 },
      });
      map.addLayer({
        id: LINE_LAYER,
        type: "line",
        source: SOURCE_ID,
        filter: ["any",
          ["==", ["geometry-type"], "LineString"],
          ["==", ["geometry-type"], "Polygon"],
        ],
        paint: { "line-color": "#06B6D4", "line-width": 2, "line-dasharray": [3, 2] },
      });
      map.addLayer({
        id: VTX_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": "#06B6D4",
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 2,
          "circle-radius": 5,
        },
      });
    };

    if (map.isStyleLoaded()) setup();
    else map.once("style.load", setup);

    const onStyle = () => { if (!map.getSource(SOURCE_ID)) setup(); };
    map.on("styledata", onStyle);

    return () => {
      map.off("styledata", onStyle);
    };
  }, [map]);

  // Update source data whenever points change
  useEffect(() => {
    if (!map) return;
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!src) return;
    const features: GeoJSON.Feature[] = pts.map((p, i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: p },
      properties: { idx: i },
    }));
    if (pts.length >= 2) {
      features.push({
        type: "Feature",
        geometry: pts.length >= 3 && mode === "ready"
          ? { type: "Polygon", coordinates: [[...pts, pts[0]]] }
          : { type: "LineString", coordinates: pts },
        properties: {},
      });
    }
    src.setData({ type: "FeatureCollection", features });
  }, [map, pts, mode]);

  // Click handler while drawing
  useEffect(() => {
    if (!map) return;
    if (mode !== "drawing") {
      map.getCanvas().style.cursor = "";
      return;
    }
    map.getCanvas().style.cursor = "crosshair";
    const onClick = (e: MapMouseEvent) => {
      e.preventDefault();
      const next: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      // If the user clicks near the first vertex with 3+ already, close.
      if (ptsRef.current.length >= 3) {
        const [fx, fy] = ptsRef.current[0];
        const dx = next[0] - fx;
        const dy = next[1] - fy;
        if (Math.sqrt(dx * dx + dy * dy) < 0.05) {
          setMode("ready");
          return;
        }
      }
      setPts((prev) => [...prev, next]);
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
      map.getCanvas().style.cursor = "";
    };
  }, [map, mode]);

  // Keyboard: Esc to cancel, Enter to close
  useEffect(() => {
    if (mode === "off") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancel();
      } else if (e.key === "Enter" && pts.length >= 3) {
        setMode("ready");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pts.length]);

  const cancel = () => {
    setMode("off");
    setPts([]);
    setProgress(null);
    setSaveOpen(false);
    setSaveName("");
    setSaveAssignee("");
    setLeads(null);
    setLeadsLoading(false);
    setLeadsError(null);
    setTypeFilter("all");
  };

  const start = () => {
    setMode("drawing");
    setPts([]);
    setLeads(null);
    setLeadsError(null);
  };

  // External trigger (Tools menu) — start drawing when `startSignal` bumps.
  const startSignalRef = useRef(startSignal);
  useEffect(() => {
    if (startSignal !== startSignalRef.current) {
      startSignalRef.current = startSignal;
      if (map) start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSignal, map]);

  /** GeoJSON Polygon (closed ring) from the drawn vertices. */
  const polygonGeoJSON = () => ({
    type: "Polygon" as const,
    coordinates: [[...pts, pts[0]]],
  });

  const findProperties = async () => {
    if (pts.length < 3) return;
    setLeadsLoading(true);
    setLeadsError(null);
    try {
      const token = await getToken();
      const res = await apiClient.post<InPolygonResponse>(
        "/v1/parcels/in-polygon",
        { polygon: polygonGeoJSON(), limit: 3000 },
        token,
      );
      setLeads(res.parcels);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 503
          ? "Property data isn't connected for your area yet."
          : e instanceof ApiError && e.status === 502
            ? "Property lookup is temporarily unavailable. Try again shortly."
            : "Couldn't load properties. Try a smaller area.";
      setLeadsError(msg);
      setLeads([]);
    } finally {
      setLeadsLoading(false);
    }
  };

  // Per-bucket counts + the currently-filtered set.
  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { all: 0, residential: 0, commercial: 0, land: 0, other: 0 };
    for (const p of leads ?? []) {
      c.all += 1;
      const b = (p.property_type as Bucket) in c ? (p.property_type as Bucket) : "other";
      c[b] += 1;
    }
    return c;
  }, [leads]);

  const filtered = useMemo(() => {
    if (!leads) return [];
    return typeFilter === "all" ? leads : leads.filter((p) => p.property_type === typeFilter);
  }, [leads, typeFilter]);

  const exportCsv = () => {
    const cols: (keyof Parcel)[] = [
      "full_address", "address", "city", "state", "zip",
      "owner_name", "owner_mailing_address",
      "property_type", "property_type_raw",
      "year_built", "building_sqft", "assessed_value", "market_value",
      "last_sold_at", "lat", "lng",
    ];
    const header = cols.join(",");
    const rows = filtered.map((p) => cols.map((c) => csvCell(p[c])).join(","));
    const csv = [header, ...rows].join("\n");
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HailScout-Leads-${stamp}-${typeFilter}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const dropLeads = async () => {
    const targets = filtered.filter((p) => p.lat != null && p.lng != null).slice(0, 100);
    if (targets.length === 0) return;
    setMode("dropping");
    setProgress({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      const p = targets[i];
      try {
        await add({ lng: p.lng as number, lat: p.lat as number, status: "lead" });
      } catch {
        // ignore individual failures
      }
      setProgress({ done: i + 1, total: targets.length });
    }
    setTimeout(() => cancel(), 1200);
  };

  const showLeadsPanel = mode === "ready" && (leadsLoading || leads !== null);
  const wide = showLeadsPanel;

  return (
    <div className="pointer-events-auto absolute top-44 right-4 z-20">
      {mode === "off" && !hideTrigger && (
        <button
          type="button"
          onClick={start}
          className="glass flex items-center gap-2 rounded-full px-3 py-2 shadow-panel transition-all hover:border-copper/40"
          aria-label="Start sweep tool"
        >
          <SweepIcon className="h-3.5 w-3.5 text-foreground/65" />
          <span className="text-xs font-medium text-foreground/85">Sweep area</span>
        </button>
      )}

      {mode !== "off" && (
        <div className={cn("glass rounded-lg p-3 shadow-panel space-y-2", wide ? "w-80" : "w-60")}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
              {showLeadsPanel ? "Lead list" : "Sweep tool"}
            </p>
            <button
              type="button"
              onClick={cancel}
              aria-label="Cancel"
              className="text-foreground/40 hover:text-foreground"
            >
              <IconClose className="h-3.5 w-3.5" />
            </button>
          </div>

          {mode === "drawing" && (
            <>
              <p className="text-xs text-foreground/85 leading-relaxed">
                Tap the map to drop polygon vertices. Click the first vertex (or hit Enter) to close.
              </p>
              <p className="font-mono-num text-[10px] text-foreground/55">
                {pts.length} vertex{pts.length === 1 ? "" : "es"} · esc to cancel
              </p>
              {pts.length >= 3 && (
                <button
                  type="button"
                  onClick={() => setMode("ready")}
                  className="w-full rounded-md border border-copper bg-copper/5 px-3 py-1.5 text-xs font-medium text-copper-700 hover:bg-copper/10"
                >
                  Close polygon ({pts.length} vertices)
                </button>
              )}
            </>
          )}

          {/* READY — default actions */}
          {mode === "ready" && !saveOpen && !showLeadsPanel && (
            <>
              <p className="text-xs text-foreground/85 leading-relaxed">
                Polygon ready. Pull the properties inside it, or save it as a named territory.
              </p>
              <button
                type="button"
                onClick={() => void findProperties()}
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-copper-700"
              >
                Find properties
              </button>
              <button
                type="button"
                onClick={() => setSaveOpen(true)}
                className="w-full rounded-md border border-copper bg-copper/5 px-3 py-2 text-xs font-medium text-copper-700 hover:bg-copper/10"
              >
                Save as territory
              </button>
            </>
          )}

          {/* READY — lead-list results */}
          {mode === "ready" && showLeadsPanel && (
            <>
              {leadsLoading ? (
                <p className="text-xs text-foreground/85">Finding properties in this area…</p>
              ) : leadsError ? (
                <>
                  <p className="text-xs text-foreground/85 leading-relaxed">{leadsError}</p>
                  <button
                    type="button"
                    onClick={() => { setLeads(null); setLeadsError(null); }}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    Back
                  </button>
                </>
              ) : (
                <>
                  <p className="font-mono-num text-[11px] text-foreground/70">
                    {filtered.length} of {counts.all} properties
                  </p>

                  {/* Land-use filter — business-type prospecting */}
                  <div className="flex flex-wrap gap-1.5">
                    {(["all", "residential", "commercial", "land", "other"] as Bucket[])
                      .filter((b) => b === "all" || counts[b] > 0)
                      .map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setTypeFilter(b)}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[10px] font-medium capitalize transition-colors",
                            typeFilter === b
                              ? "bg-copper text-primary-foreground"
                              : "bg-secondary/60 text-foreground hover:bg-secondary",
                          )}
                        >
                          {b} {b === "all" ? counts.all : counts[b]}
                        </button>
                      ))}
                  </div>

                  {counts.all === 0 ? (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      No property records found here yet — coverage is still being
                      added county by county. Try a different area, or save it as a
                      territory for now.
                    </p>
                  ) : (
                    <ul className="max-h-44 overflow-y-auto divide-y divide-border/50 rounded-md border border-border/60">
                      {filtered.slice(0, 200).map((p, i) => (
                        <li key={p.id ?? i} className="px-2.5 py-1.5">
                          <p className="truncate text-xs text-foreground">
                            {p.full_address ?? p.address ?? "Unknown address"}
                          </p>
                          <p className="truncate font-mono-num text-[10px] text-muted-foreground">
                            <span className="capitalize">{p.property_type}</span>
                            {p.owner_name ? ` · ${p.owner_name}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      disabled={filtered.length === 0}
                      onClick={exportCsv}
                      className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-atlas hover:bg-copper-700 disabled:opacity-50"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      disabled={filtered.length === 0}
                      onClick={() => void dropLeads()}
                      className="flex-1 rounded-md border border-copper bg-copper/5 px-3 py-2 text-xs font-medium text-copper-700 hover:bg-copper/10 disabled:opacity-50"
                      title="Drop up to 100 of these as canvassing markers"
                    >
                      Drop as markers
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* READY — save-territory form */}
          {mode === "ready" && saveOpen && (
            <>
              <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
                Save territory
              </p>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="North Dallas — Crew A"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-copper focus:outline-none"
              />
              <select
                value={saveAssignee}
                onChange={(e) => setSaveAssignee(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-copper focus:outline-none"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.email.split("@")[0]} ({m.role})</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSaveOpen(false)}
                  className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!saveName.trim()}
                  onClick={async () => {
                    await createTerritory({
                      name: saveName.trim(),
                      polygon: pts,
                      assignee_user_id: saveAssignee || undefined,
                    });
                    cancel();
                  }}
                  className="flex-1 rounded-md bg-copper px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-copper-700 disabled:opacity-60"
                >
                  Save zone
                </button>
              </div>
            </>
          )}

          {mode === "dropping" && progress && (
            <>
              <p className="text-xs text-foreground/85">
                Dropping markers… <span className="font-mono-num">{progress.done}/{progress.total}</span>
              </p>
              <div className="h-1.5 w-full bg-foreground/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-copper transition-all"
                  style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** CSV-escape a cell (quote if it contains comma/quote/newline). */
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function SweepIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 13L8 3L13 13Z" />
      <path d="M3 13L13 13" strokeDasharray="2 2" />
    </svg>
  );
}
