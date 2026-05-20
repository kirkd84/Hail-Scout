"use client";

/**
 * Live-data storms layer.
 *
 * Renders hail-swath polygon bands AND storm centroids on the MapLibre
 * map from a `StormWithSwaths[]` array. Designed to swap in for
 * `<StormFixturesLayer>` once `/v1/storms?include=swaths` has data.
 *
 * Two render layers:
 *   - swath polygons (per-category color, painted smallest-first so
 *     larger-hail bands sit on top — same visual logic as HailTrace
 *     and Interactive Hail Maps).
 *   - centroids (colored circle sized by peak hail size).
 *
 * Filter behavior matches StormFixturesLayer:
 *   - `minSizeIn` hides storms / swath bands below the threshold
 *   - `startTimeMin` / `startTimeMax` window the time range
 */

import { useEffect, useMemo, useState } from "react";
import { Popup } from "maplibre-gl";
import type { Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import type { StormWithSwaths } from "@/hooks/useStorms";
import { hailColor } from "@/lib/hail";
import { nearestMetro } from "@/lib/metros";

const SOURCE_BANDS = "hs-live-bands";
const SOURCE_CENTROIDS = "hs-live-centroids";
const LAYER_GLOW = "hs-live-glow";       // soft halo under fills
const LAYER_FILL = "hs-live-fill";
const LAYER_LINE = "hs-live-line";
const LAYER_CENTROID = "hs-live-centroid";
const LAYER_CENTROID_RING = "hs-live-centroid-ring";
const LAYER_DATE_LABEL = "hs-live-date-label";

interface Props {
  map: MapLibreMap | null;
  storms: StormWithSwaths[];
  visible?: boolean;
  /** Unix-millis cutoff. Storms started before this are hidden. */
  startTimeMin?: number | null;
  /** Hail size threshold in inches. Storms / bands below this are hidden. */
  minSizeIn?: number;
  /** Time scrubber cursor. Storms started after this are hidden. */
  startTimeMax?: number | null;
  /** Called when the user clicks a centroid or swath on the map.
   *  Parent typically opens a detail sheet. */
  onStormClick?: (stormId: string) => void;
}

/** Map hail_size_category label (e.g. "1.5", "3.0+") → min inches. */
function categoryToMinInches(label: string): number {
  const n = parseFloat(label.replace("+", ""));
  return Number.isFinite(n) ? n : 0;
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  // "May 11" / "Aug 03" — same format the time-scrubber uses.
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function buildCentroidFC(storms: StormWithSwaths[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: storms.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.centroid_lng, s.centroid_lat] },
      properties: {
        id: s.id,
        peak_size_in: s.max_hail_size_in,
        start_time: s.start_time,
        date_label: formatDateLabel(s.start_time),
        peak_label: `${s.max_hail_size_in.toFixed(1)}″`,
      },
    })),
  };
}

function buildBandsFC(storms: StormWithSwaths[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const s of storms) {
    if (!s.swaths) continue;
    for (const sw of s.swaths) {
      if (!sw.geometry) continue;
      features.push({
        type: "Feature",
        geometry: sw.geometry,
        properties: {
          storm_id: s.id,
          min_size_in: categoryToMinInches(sw.hail_size_category),
          start_time: s.start_time,
        },
      });
    }
  }
  // Smallest-hail bands drawn first so larger-hail bands stack on top.
  features.sort(
    (a, b) =>
      (Number(a.properties?.min_size_in) || 0) -
      (Number(b.properties?.min_size_in) || 0),
  );
  return { type: "FeatureCollection", features };
}

export function StormsLayer({
  map,
  storms,
  visible = true,
  startTimeMin = null,
  minSizeIn = 0,
  startTimeMax = null,
  onStormClick,
}: Props) {
  // Filtered storms (applied to both centroids and bands).
  const filtered = useMemo(() => {
    return storms.filter((s) => {
      if (s.max_hail_size_in < minSizeIn) return false;
      const t = new Date(s.start_time).getTime();
      if (startTimeMin !== null && t < startTimeMin) return false;
      if (startTimeMax !== null && t > startTimeMax) return false;
      return true;
    });
  }, [storms, minSizeIn, startTimeMin, startTimeMax]);

  // `styleEpoch` bumps every time the basemap style is swapped (atlas →
  // satellite → streets etc.). The setData effect depends on it so swath
  // data gets re-pushed onto freshly-recreated sources — otherwise the
  // layer was rendering empty after a basemap toggle.
  const [styleEpoch, setStyleEpoch] = useState(0);

  // ── Layer setup (once per map / per style swap) ──────────────────
  useEffect(() => {
    if (!map) return;

    const addLayers = () => {
      if (map.getSource(SOURCE_BANDS)) return;

      // Bands source (loaded empty; populated by the data effect).
      map.addSource(SOURCE_BANDS, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Polish notes:
      //  - GLOW layer: an oversized blurred stroke painted UNDER the
      //    fill gives each swath a soft halo, the HailTrace signature.
      //    Implemented as a line with heavy line-blur — cheaper than
      //    a shadow extrusion and renders well on both basemaps.
      //  - FILL layer: opacity climbs sharply with hail size so small
      //    bands fade and severe-hail cores read loud.
      //  - LINE layer: hair-thin, color-matched, with a touch of blur
      //    so the polygon outline feels organic instead of grid-snapped.
      // Glow halo — kept subtle so it accents the SEVERE tiers only.
      // Light hail had a glow that competed with the fill and blurred
      // adjacent cells into one wash. Now: nothing under 1.5", a soft
      // edge at 2.0", visible halo only at the softball tier.
      map.addLayer({
        id: LAYER_GLOW,
        type: "line",
        source: SOURCE_BANDS,
        filter: [">=", ["get", "min_size_in"], 1.5],
        paint: {
          "line-color": [
            "step", ["get", "min_size_in"],
            "#C46434",
            1.75, "#A8412D",
            2.0,  "#822424",
            2.5,  "#5B2059",
            3.0,  "#1F1B33",
          ],
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            3,  2,
            6,  6,
            9,  14,
          ],
          "line-blur": [
            "interpolate", ["linear"], ["zoom"],
            3,  3,
            6,  7,
            9,  12,
          ],
          "line-opacity": [
            "interpolate", ["linear"], ["get", "min_size_in"],
            1.5,  0.12,
            2.0,  0.22,
            3.0,  0.36,
          ],
        },
      });

      map.addLayer({
        id: LAYER_FILL,
        type: "fill",
        source: SOURCE_BANDS,
        paint: {
          "fill-color": [
            "step", ["get", "min_size_in"],
            "#5DCAA5",       // 0.75 — soft teal-green
            1.0,  "#E2B843", // amber
            1.25, "#D88A3D", // copper
            1.5,  "#C46434", // burnt orange
            1.75, "#A8412D", // brick
            2.0,  "#822424", // oxblood
            2.5,  "#5B2059", // plum
            3.0,  "#1F1B33", // deep purple
          ],
          // Lower opacities all around so overlapping cells layer
          // cleanly instead of producing one opaque mass. The severe
          // tiers still read because the glow halo amplifies them.
          "fill-opacity": [
            "interpolate", ["linear"], ["get", "min_size_in"],
            0.75, 0.22,
            1.0,  0.32,
            1.5,  0.48,
            2.0,  0.62,
            2.5,  0.74,
            3.0,  0.84,
          ],
          // Subtle blur on the antialiased fill edges. MapLibre paints
          // polygon fills with hard edges; fill-antialias=true plus the
          // glow underneath does most of the smoothing visually.
          "fill-antialias": true,
        },
      });

      map.addLayer({
        id: LAYER_LINE,
        type: "line",
        source: SOURCE_BANDS,
        paint: {
          "line-color": [
            "step", ["get", "min_size_in"],
            "#3FAF8A",
            1.0,  "#C19A2E",
            1.25, "#B66B2A",
            1.5,  "#9E4823",
            1.75, "#82301F",
            2.0,  "#5E1B1B",
            2.5,  "#3F143E",
            3.0,  "#0F0E1E",
          ],
          // Stronger outline — defines the shape of each cell instead
          // of letting fills bleed into each other. Crisper at all
          // zoom levels than before.
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            3, 0.6,
            6, 1.1,
            9, 1.6,
          ],
          "line-blur": 0.3,
          "line-opacity": 0.75,
        },
      });

      // Centroid source + layers — painted ON TOP of polygons.
      map.addSource(SOURCE_CENTROIDS, {
        type: "geojson",
        data: buildCentroidFC([]),
      });

      map.addLayer({
        id: LAYER_CENTROID_RING,
        type: "circle",
        source: SOURCE_CENTROIDS,
        minzoom: 4,
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["get", "peak_size_in"],
            0.75, 8,
            1.75, 12,
            2.75, 16,
            3.5, 20,
          ],
          "circle-color": [
            "step", ["get", "peak_size_in"],
            "#36C168", 1.0, "#F2D530", 1.5, "#EA7A2C", 1.75, "#D9462F",
            2.0, "#A11F2A", 2.5, "#D45BAA", 2.75, "#8E3CA8", 3.0, "#4A2070",
          ],
          "circle-opacity": 0.18,
          "circle-stroke-width": 0,
        },
      });

      map.addLayer({
        id: LAYER_CENTROID,
        type: "circle",
        source: SOURCE_CENTROIDS,
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["get", "peak_size_in"],
            0.75, 4,
            1.75, 5,
            3.5, 7,
          ],
          "circle-color": [
            "step", ["get", "peak_size_in"],
            "#5DCAA5", 1.0, "#E2B843", 1.25, "#D88A3D", 1.5, "#C46434",
            1.75, "#A8412D", 2.0, "#822424", 2.5, "#5B2059", 3.0, "#1F1B33",
          ],
          "circle-stroke-color": "#FAF7F1",
          "circle-stroke-width": 1.6,
          "circle-opacity": 1,
        },
      });

      // Date label — appears next to each centroid. Two-line text:
      // date on top, peak size below. Painted at zoom 5+ to keep the
      // CONUS view uncluttered.
      map.addLayer({
        id: LAYER_DATE_LABEL,
        type: "symbol",
        source: SOURCE_CENTROIDS,
        minzoom: 5,
        layout: {
          "text-field": ["format",
            ["get", "date_label"], { "font-scale": 1.0 },
            "\n",                  {},
            ["get", "peak_label"], { "font-scale": 0.85 },
          ],
          "text-anchor": "left",
          "text-offset": [0.9, 0],
          "text-size": [
            "interpolate", ["linear"], ["zoom"],
            5, 10,
            8, 12,
            12, 14,
          ],
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "text-padding": 4,
        },
        paint: {
          "text-color": "#2B2620",      // matches --foreground
          "text-halo-color": "#FAF7F1", // matches --cream-50
          "text-halo-width": 1.4,
          "text-halo-blur": 0.2,
        },
      });
    };

    if (map.isStyleLoaded()) {
      addLayers();
    } else {
      map.once("style.load", addLayers);
    }

    // Re-add on basemap-style swap (sources are wiped on setStyle).
    // Bump styleEpoch so the data effect re-fires and re-populates the
    // freshly-recreated sources — without this, switching to satellite
    // / streets / hybrid wiped the swaths.
    const onStyle = () => {
      if (!map.getSource(SOURCE_BANDS)) {
        addLayers();
        setStyleEpoch((e) => e + 1);
      }
    };
    map.on("styledata", onStyle);

    return () => {
      map.off("styledata", onStyle);
    };
  }, [map]);

  // ── Data effect: push filtered storms into both sources ─────────
  // styleEpoch is in the deps so a basemap swap triggers a re-push.
  useEffect(() => {
    if (!map) return;
    const bsrc = map.getSource(SOURCE_BANDS);
    const csrc = map.getSource(SOURCE_CENTROIDS);
    if (!bsrc || !csrc) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (csrc as any).setData(buildCentroidFC(filtered));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (bsrc as any).setData(buildBandsFC(filtered));
  }, [map, filtered, styleEpoch]);

  // ── Band-size filter (applied via setFilter on the layers) ───────
  useEffect(() => {
    if (!map) return;
    const bandFilter =
      minSizeIn > 0
        ? ["all", [">=", ["get", "min_size_in"], minSizeIn]]
        : null;
    if (map.getLayer(LAYER_FILL)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.setFilter(LAYER_GLOW, bandFilter as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.setFilter(LAYER_FILL, bandFilter as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.setFilter(LAYER_LINE, bandFilter as any);
    }
  }, [map, minSizeIn]);

  // ── Visibility toggle ────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    const v = visible ? "visible" : "none";
    for (const id of [LAYER_GLOW, LAYER_FILL, LAYER_LINE, LAYER_CENTROID, LAYER_CENTROID_RING, LAYER_DATE_LABEL]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    }
  }, [map, visible]);

  // ── Pointer cursor + hover popup + click → open detail ──────────
  // Hovering shows a small popup card with date + size + metro.
  // Clicking bubbles the storm_id to onStormClick (parent typically
  // opens a full-detail sheet). Centroid features carry `id` directly;
  // band (swath) features carry `storm_id`.
  useEffect(() => {
    if (!map) return;
    const clickableLayers = [LAYER_CENTROID, LAYER_CENTROID_RING, LAYER_FILL];

    // Tooltip popup — reused across hovers so we don't churn DOM.
    // closeButton: false so it disappears on mouseleave instead of
    // sitting there with an X. className gives us the brand styling
    // hooks; rest is inline so we don't ship a stylesheet for this.
    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
      className: "hs-storm-popup",
    });

    const stormById = new Map(storms.map((s) => [s.id, s]));

    const onEnter = (e: MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = "pointer";
      const feat = e.features?.[0];
      if (!feat) return;
      const stormId =
        (feat.properties?.id as string | undefined) ??
        (feat.properties?.storm_id as string | undefined);
      if (!stormId) return;
      const s = stormById.get(stormId);
      if (!s) return;
      const c = hailColor(s.max_hail_size_in);
      const where = nearestMetro(s.centroid_lat, s.centroid_lng);
      const heavy = s.max_hail_size_in >= 1.5;
      const badgeFg = heavy ? "#FAF7F1" : c.text;
      const dateStr = new Date(s.start_time).toLocaleDateString(undefined, {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
      // Inline HTML kept tight; styling matches the picker card.
      // The LSR-confirmed pill appears only when an SPC ground-truth
      // report fell inside this cell within ±30 min — it's a quiet
      // green checkmark, not a flashy badge, so the popup still reads
      // as one piece of information rather than two.
      const confirmedPill = s.lsr_confirmed
        ? `<span style="display:inline-flex;align-items:center;gap:3px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;color:#2f7a4f;background:rgba(47,122,79,0.12);border:1px solid rgba(47,122,79,0.3);border-radius:3px;padding:1px 5px;margin-left:6px;vertical-align:middle;">✓ Confirmed</span>`
        : "";
      const lsrSizeNote =
        s.lsr_confirmed && s.lsr_observed_size_in
          ? `<div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;opacity:0.55;margin-top:2px;">Ground report: ${s.lsr_observed_size_in.toFixed(
              2,
            )}″</div>`
          : "";
      const html = `
        <div style="display:flex;gap:10px;align-items:flex-start;padding:8px 10px;min-width:200px;">
          <span style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:42px;height:38px;border-radius:6px;background:${c.solid};color:${badgeFg};box-shadow:0 1px 3px rgba(0,0,0,0.15);">
            <span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;font-weight:500;line-height:1;">${s.max_hail_size_in.toFixed(2)}″</span>
            <span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:8px;text-transform:uppercase;letter-spacing:0.08em;line-height:1;margin-top:2px;opacity:0.9;">${c.object}</span>
          </span>
          <div style="min-width:0;">
            <div style="font-family:Fraunces,Cambria,serif;font-size:15px;font-weight:500;letter-spacing:-0.01em;line-height:1.2;">${where?.label ?? "United States"}${confirmedPill}</div>
            <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;opacity:0.65;margin-top:3px;">${dateStr} · ${s.source}</div>
            ${lsrSizeNote}
          </div>
        </div>`;
      popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
    };
    const onMove = (e: MapLayerMouseEvent) => {
      popup.setLngLat(e.lngLat);
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    };
    const onClick = (e: MapLayerMouseEvent) => {
      if (!onStormClick) return;
      const feat = e.features?.[0];
      if (!feat) return;
      const stormId =
        (feat.properties?.id as string | undefined) ??
        (feat.properties?.storm_id as string | undefined);
      if (stormId) onStormClick(stormId);
    };

    for (const id of clickableLayers) {
      map.on("mouseenter", id, onEnter);
      map.on("mousemove", id, onMove);
      map.on("mouseleave", id, onLeave);
      map.on("click", id, onClick);
    }
    return () => {
      for (const id of clickableLayers) {
        map.off("mouseenter", id, onEnter);
        map.off("mousemove", id, onMove);
        map.off("mouseleave", id, onLeave);
        map.off("click", id, onClick);
      }
      popup.remove();
    };
  }, [map, onStormClick, storms]);

  return null;
}
