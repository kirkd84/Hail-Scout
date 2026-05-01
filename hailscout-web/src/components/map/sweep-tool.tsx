"use client";

import { useEffect, useState, useRef } from "react";
import type { Map as MapLibreMap, MapMouseEvent, GeoJSONSource } from "maplibre-gl";
import { useMarkers } from "@/hooks/useMarkers";
import { useTerritories } from "@/hooks/useTerritories";
import { useTeam } from "@/hooks/useTeam";
import { cn } from "@/lib/utils";
import { IconClose } from "@/components/icons";

const SOURCE_ID  = "hs-sweep-poly";
const FILL_LAYER = "hs-sweep-fill";
const LINE_LAYER = "hs-sweep-line";
const VTX_LAYER  = "hs-sweep-vtx";

type Mode = "off" | "drawing" | "ready" | "dropping";

interface Props {
  map: MapLibreMap | null;
}

/**
 * "Sweep this area" — draw a polygon, drop a marker at every synthetic
 * parcel inside. For the demo the parcels are generated on-the-fly:
 * a jittered grid of points within the polygon. Each becomes a 'lead'
 * marker through useMarkers().add(...).
 *
 * Keyboard: Esc cancels drawing. Enter closes the polygon (or
 * double-tap the start vertex).
 */
export function SweepTool({ map }: Props) {
  const [mode, setMode] = useState<Mode>("off");
  const [pts, setPts] = useState<[number, number][]>([]);
  const ptsRef = useRef<[number, number][]>([]);
  ptsRef.current = pts;
  const { add } = useMarkers();
  const { create: createTerritory } = useTerritories();
  const { members } = useTeam();
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveAssignee, setSaveAssignee] = useState<string>("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

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
        paint: { "fill-color": "#D87C4A", "fill-opacity": 0.10 },
      });
      map.addLayer({
        id: LINE_LAYER,
        type: "line",
        source: SOURCE_ID,
        filter: ["any",
          ["==", ["geometry-type"], "LineString"],
          ["==", ["geometry-type"], "Polygon"],
        ],
        paint: { "line-color": "#D87C4A", "line-width": 2, "line-dasharray": [3, 2] },
      });
      map.addLayer({
        id: VTX_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": "#D87C4A",
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
  };

  const start = () => {
    setMode("drawing");
    setPts([]);
  };

  const sweep = async () => {
    if (pts.length < 3) return;
    setMode("dropping");

    // Generate synthetic parcels — jittered grid inside the polygon's bbox,
    // filtered to those inside the polygon.
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const stepX = (maxX - minX) / 10;
    const stepY = (maxY - minY) / 10;
    const candidates: [number, number][] = [];
    for (let x = minX + stepX / 2; x < maxX; x += stepX) {
      for (let y = minY + stepY / 2; y < maxY; y += stepY) {
        // Jitter for organic feel
        const jx = (Math.random() - 0.5) * stepX * 0.4;
        const jy = (Math.random() - 0.5) * stepY * 0.4;
        candidates.push([x + jx, y + jy]);
      }
    }
    const inside = candidates.filter((c) => pointInRing(c, pts));
    // Cap at 50 to avoid runaway loads
    const targets = inside.slice(0, 50);

    setProgress({ done: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      const [lng, lat] = targets[i];
      try {
        await add({ lng, lat, status: "lead" });
      } catch {
        // ignore individual failures
      }
      setProgress({ done: i + 1, total: targets.length });
    }

    // Hold for a beat, then exit
    setTimeout(() => cancel(), 1200);
  };

  return (
    <div className="pointer-events-auto absolute top-44 right-4 z-20">
      {mode === "off" && (
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
        <div className="glass rounded-lg p-3 shadow-panel w-60 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
              Sweep tool
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

          {mode === "ready" && !saveOpen && (
            <>
              <p className="text-xs text-foreground/85 leading-relaxed">
                Polygon ready. Sweep drops up to 50 markers, or save the polygon as a named territory.
              </p>
              <button
                type="button"
                onClick={() => void sweep()}
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900"
              >
                Drop markers
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

function SweepIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 13L8 3L13 13Z" />
      <path d="M3 13L13 13" strokeDasharray="2 2" />
    </svg>
  );
}

/** Point-in-polygon (ray casting). */
function pointInRing(p: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > p[1] !== yj > p[1] &&
      p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
