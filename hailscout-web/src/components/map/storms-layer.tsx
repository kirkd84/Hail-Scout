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
import { firstSymbolLayerId } from "@/components/map/storms-raster-layer";

const SOURCE_BANDS = "hs-live-bands";
const SOURCE_CENTROIDS = "hs-live-centroids";
const LAYER_GLOW = "hs-live-glow";       // soft halo under fills
const LAYER_FILL = "hs-live-fill";
const LAYER_LINE = "hs-live-line";
// Always-present, fully-transparent fill used only for hover/click
// hit-testing. Stays queryable in every view mode (incl. smooth, where
// the visible bands are hidden under the raster), so we can read the
// hail size AT the cursor anywhere over a swath — like IHM.
const LAYER_PROBE = "hs-live-probe";
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
  /** Hide the polygon bands (glow/fill/line) but keep centroids +
   *  click/hover interactivity. Used in "smooth" view mode where the
   *  raster surface replaces the bands but we still want clickable
   *  storm points. */
  bandsHidden?: boolean;
  /** When set, the map isolates this single storm — bands + centroids
   *  filter to it. Used when a storm is selected from the picker/detail. */
  focusStormId?: string | null;
  /** Called when the user clicks a centroid or swath on the map.
   *  Parent typically opens a detail sheet. */
  onStormClick?: (stormId: string) => void;
}

/** Map hail_size_category label (e.g. "1.5", "3.0+") → min inches. */
function categoryToMinInches(label: string): number {
  const n = parseFloat(label.replace("+", ""));
  return Number.isFinite(n) ? n : 0;
}

// The discrete size-category ladder (inches). Our swaths are stored as bands
// on these floors, so the honest at-point answer is a RANGE, not a single
// decimal — which is why a smooth color gradient within one band reads the
// same size everywhere (the shading between bands is cosmetic blur, not data).
const SIZE_LADDER = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

/** Band range for a category floor: 1.0 → "1.00–1.25″", 3.0 → "≥3.00″". */
function bandRangeLabel(floor: number): string {
  const i = SIZE_LADDER.findIndex((x) => Math.abs(x - floor) < 1e-6);
  if (i === -1) return `${floor.toFixed(2)}″`;
  if (i === SIZE_LADDER.length - 1) return `≥${floor.toFixed(2)}″`;
  return `${floor.toFixed(2)}–${SIZE_LADDER[i + 1].toFixed(2)}″`;
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
        suspect: s.suspect ? true : false,
        is_ground: s.source === "SPC-LSR",
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
          suspect: s.suspect ? true : false,
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
  bandsHidden = false,
  focusStormId = null,
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

      // Paint the swath bands BENEATH the basemap's label layers so
      // street/city names stay crisp on top — the HailStrike/IHM look.
      // Centroids + date labels intentionally go on top (no anchor).
      const labelAnchor = firstSymbolLayerId(map);

      // Invisible probe fill — always rendered (opacity 0) so hover/click
      // hit-testing works in every view mode, including smooth where the
      // visible bands are hidden. Added first so it sits beneath the
      // visible layers.
      map.addLayer({
        id: LAYER_PROBE,
        type: "fill",
        source: SOURCE_BANDS,
        paint: { "fill-opacity": 0 },
      }, labelAnchor);

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
      }, labelAnchor);

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
            "*",
            [
              "interpolate", ["linear"], ["get", "min_size_in"],
              0.75, 0.22,
              1.0,  0.32,
              1.5,  0.48,
              2.0,  0.62,
              2.5,  0.74,
              3.0,  0.84,
            ],
            // Unverified (suspect) cells render at 40% so they read as
            // "present but provisional" beside confirmed cells.
            ["case", ["==", ["get", "suspect"], true], 0.4, 1.0],
          ],
          // Subtle blur on the antialiased fill edges. MapLibre paints
          // polygon fills with hard edges; fill-antialias=true plus the
          // glow underneath does most of the smoothing visually.
          "fill-antialias": true,
        },
      }, labelAnchor);

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
      }, labelAnchor);

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
          // Ground reports (SPC-LSR points) get a green ring so they read as
          // gold-standard ground truth, distinct from cream radar centroids.
          "circle-stroke-color": [
            "case", ["==", ["get", "is_ground"], true], "#2f7a4f", "#FAF7F1",
          ],
          "circle-stroke-width": ["case", ["==", ["get", "is_ground"], true], 2.2, 1.6],
          "circle-opacity": ["case", ["==", ["get", "suspect"], true], 0.5, 1],
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

  // ── Band-size + focus filter (applied via setFilter on the layers) ──
  // When focusStormId is set (a storm is selected), the map isolates
  // that one storm — bands/probe filter by storm_id, centroids by id —
  // so "click a date → see just that swath" works.
  useEffect(() => {
    if (!map) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sizeClause: any[] | null =
      minSizeIn > 0 ? [">=", ["get", "min_size_in"], minSizeIn] : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const focusBandClause: any[] | null =
      focusStormId ? ["==", ["get", "storm_id"], focusStormId] : null;
    const bandClauses = [sizeClause, focusBandClause].filter(Boolean);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bandFilter: any =
      bandClauses.length === 0 ? null : ["all", ...bandClauses];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const centroidFilter: any = focusStormId
      ? ["==", ["get", "id"], focusStormId]
      : null;

    for (const id of [LAYER_GLOW, LAYER_FILL, LAYER_LINE, LAYER_PROBE]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (map.getLayer(id)) map.setFilter(id, bandFilter as any);
    }
    for (const id of [LAYER_CENTROID, LAYER_CENTROID_RING, LAYER_DATE_LABEL]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (map.getLayer(id)) map.setFilter(id, centroidFilter as any);
    }
  }, [map, minSizeIn, focusStormId]);

  // ── Visibility toggle ────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    const v = visible ? "visible" : "none";
    // Band layers can be independently hidden (smooth mode) while the
    // centroid/interaction layers stay visible + clickable.
    const bandV = visible && !bandsHidden ? "visible" : "none";
    const bandLayers = [LAYER_GLOW, LAYER_FILL, LAYER_LINE];
    // PROBE + centroids track overall visibility (on in cells AND smooth)
    // so hover hit-testing survives smooth mode where the bands are hidden.
    const pointLayers = [
      LAYER_PROBE, LAYER_CENTROID, LAYER_CENTROID_RING, LAYER_DATE_LABEL,
    ];
    for (const id of bandLayers) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", bandV);
    }
    for (const id of pointLayers) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    }
  }, [map, visible, bandsHidden]);

  // ── Pointer cursor + hover popup + click → open detail ──────────
  // Hovering shows a small popup card with date + size + metro.
  // Clicking bubbles the storm_id to onStormClick (parent typically
  // opens a full-detail sheet). Centroid features carry `id` directly;
  // band (swath) features carry `storm_id`.
  useEffect(() => {
    if (!map) return;
    // Use the always-queryable PROBE for swath hit-testing so the local
    // size readout works in every view mode (incl. smooth).
    const clickableLayers = [LAYER_CENTROID, LAYER_CENTROID_RING, LAYER_PROBE];

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

    // Build + show the popup for whatever feature is under the cursor RIGHT
    // NOW. Called on both enter AND move so the size readout updates live as
    // you sweep across a swath — previously move only repositioned the popup,
    // so the number never refreshed until you exited and re-entered.
    const render = (e: MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const stormId =
        (feat.properties?.id as string | undefined) ??
        (feat.properties?.storm_id as string | undefined);
      if (!stormId) return;
      const s = stormById.get(stormId);
      if (!s) return;
      // LOCAL size at the cursor: when hovering a swath band, the band's
      // min_size_in is the hail size that fell HERE — what a roofer needs
      // to target a neighborhood. Fall back to the storm peak only when
      // hovering a centroid (no band under the cursor).
      const bandSize = feat.properties?.min_size_in;
      const isBand = typeof bandSize === "number";
      const localSize = isBand ? bandSize : s.max_hail_size_in;
      // Ground-truth fusion ("fuse + override"): a confirmed SPC report that
      // is larger than the radar read at this cell wins — a spotter/SPC
      // measurement beats a radar estimate. We only ever override UPWARD.
      const groundSize =
        s.lsr_confirmed && typeof s.lsr_observed_size_in === "number"
          ? s.lsr_observed_size_in
          : null;
      const isGroundReport = s.source === "SPC-LSR";
      const displaySize =
        groundSize != null && groundSize > localSize ? groundSize : localSize;
      const c = hailColor(displaySize);
      const where = nearestMetro(s.centroid_lat, s.centroid_lng);
      const heavy = displaySize >= 1.5;
      const badgeFg = heavy ? "#FAF7F1" : c.text;
      const dateStr = new Date(s.start_time).toLocaleDateString(undefined, {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
      // Show the storm's peak as context only when it's bigger than the
      // local size — so the user knows this neighborhood saw less than
      // the storm's worst.
      const peakNote =
        s.max_hail_size_in > displaySize + 0.01
          ? `<div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;opacity:0.55;margin-top:2px;">Storm peak: ${s.max_hail_size_in.toFixed(2)}″ elsewhere</div>`
          : "";
      // Honest at-point precision: we store hail in 0.25″ category bands, so
      // the size HERE is a range. Showing it explains why a smooth color
      // gradient inside one band reads the same size everywhere.
      const bandNote = isBand
        ? `<div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;opacity:0.7;margin-top:3px;">Size band: ${bandRangeLabel(localSize)}</div>`
        : "";
      // Inline HTML kept tight; styling matches the picker card.
      // The LSR-confirmed pill appears only when an SPC ground-truth
      // report fell inside this cell within ±30 min — it's a quiet
      // green checkmark, not a flashy badge, so the popup still reads
      // as one piece of information rather than two.
      const confirmedPill = s.lsr_confirmed
        ? `<span style="display:inline-flex;align-items:center;gap:3px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;color:#2f7a4f;background:rgba(47,122,79,0.12);border:1px solid rgba(47,122,79,0.3);border-radius:3px;padding:1px 5px;margin-left:6px;vertical-align:middle;">✓ Confirmed</span>`
        : "";
      // Unverified pill — only when the cell is suspect AND not LSR-confirmed.
      // Communicates the confidence tier instead of hiding the cell entirely.
      const unverifiedPill =
        s.suspect && !s.lsr_confirmed
          ? `<span style="display:inline-flex;align-items:center;gap:3px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;color:#9a6a1a;background:rgba(216,138,61,0.14);border:1px solid rgba(216,138,61,0.4);border-radius:3px;padding:1px 5px;margin-left:6px;vertical-align:middle;">⚠ Unverified</span>`
          : "";
      const suspectNote =
        s.suspect && !s.lsr_confirmed
          ? `<div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;opacity:0.6;margin-top:2px;color:#9a6a1a;">Radar-only — not yet cross-confirmed</div>`
          : "";
      // SPC ground-report point (source="SPC-LSR"): a human-filed observation,
      // the gold standard. Distinct green pill so it never reads as radar.
      const groundReportPill = isGroundReport
        ? `<span style="display:inline-flex;align-items:center;gap:3px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;color:#2f7a4f;background:rgba(47,122,79,0.12);border:1px solid rgba(47,122,79,0.3);border-radius:3px;padding:1px 5px;margin-left:6px;vertical-align:middle;">● Ground report</span>`
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
            <span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;font-weight:500;line-height:1;">${displaySize.toFixed(2)}″</span>
            <span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:8px;text-transform:uppercase;letter-spacing:0.08em;line-height:1;margin-top:2px;opacity:0.9;">${c.object}</span>
          </span>
          <div style="min-width:0;">
            <div style="font-family:Fraunces,Cambria,serif;font-size:15px;font-weight:500;letter-spacing:-0.01em;line-height:1.2;">${where?.label ?? "United States"}${confirmedPill}${unverifiedPill}${groundReportPill}</div>
            <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;opacity:0.65;margin-top:3px;">${dateStr} · ${s.source}</div>
            ${bandNote}
            ${peakNote}
            ${lsrSizeNote}
            ${suspectNote}
          </div>
        </div>`;
      popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
    };
    const onEnter = (e: MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = "pointer";
      render(e);
    };
    const onMove = render;
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
