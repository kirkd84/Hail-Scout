"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { HailAtAddressResponse, Storm } from "@/lib/api-types";
import { HailMap } from "@/components/map/HailMap";
import { BasemapToggle, type BasemapId } from "@/components/map/basemap-toggle";
import { StormsLayer } from "@/components/map/storms-layer";
import { StormsHeatmapLayer } from "@/components/map/storms-heatmap-layer";
import { StormsRasterLayer } from "@/components/map/storms-raster-layer";
import { NexradStationsLayer } from "@/components/map/nexrad-stations-layer";
import { TimeScrubber } from "@/components/map/time-scrubber";
import { useStorms } from "@/hooks/useStorms";
import { useViewportRaster } from "@/hooks/useViewportRaster";
import { useStormRaster } from "@/hooks/useStormRaster";
import { StormDatePicker } from "@/components/map/storm-date-picker";
import {
  sizeFilterToMin,
  type SizeFilter,
  type SourceFilter,
} from "@/components/map/map-filters";
import { MobileMapControls } from "@/components/map/mobile-map-controls";
import { MarkersLayer } from "@/components/map/markers-layer";
import { DropModeToggle } from "@/components/map/drop-mode-toggle";
import { MapToolsMenu } from "@/components/map/map-tools-menu";
import { LegendButton } from "@/components/map/legend-button";
import { AddressSearch } from "@/components/app/address-search";
import { MarkerEditor } from "@/components/app/marker-editor";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StormList } from "@/components/app/storm-list";
import { StormDetailSheet } from "@/components/app/storm-detail-sheet";
import { SaveAddressButton } from "@/components/app/save-address-button";
import { WelcomeTour } from "@/components/app/welcome-tour";
import { SweepTool } from "@/components/map/sweep-tool";
import { TerritoriesLayer } from "@/components/map/territories-layer";
import { useTerritories } from "@/hooks/useTerritories";
import { useSearchParams } from "next/navigation";
import { searchAddress } from "@/lib/geocode";
import { useMarkers } from "@/hooks/useMarkers";

const utcDay = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export default function MapPage() {
  const isMobile = useIsMobile();
  const { territories } = useTerritories();
  const [map, setMap] = useState<MapLibreMap | null>(null);
  // Default to Streets (MapTiler Streets v2) — the clean, Google-Maps-like
  // basemap. Switchable any time via the BasemapToggle.
  const [basemap, setBasemap] = useState<BasemapId>("streets");
  const [size, setSize] = useState<SizeFilter>("any");
  const [source, setSource] = useState<SourceFilter>("all");
  const [scrubberMs, setScrubberMs] = useState<number | null>(null);
  // View mode: "cells" (per-cell polygons + centroids), "smooth" (raster
  // surface), or "heatmap" (density overlay).
  const [viewMode, setViewMode] = useState<"cells" | "smooth" | "heatmap">("smooth");
  // Show suspect/low-confidence cells (flagged). ON by default so the
  // footprint reflects reality (closes the gap vs IHM); each unverified cell
  // renders dimmed and is flagged on hover. Toggle lives in the picker's filters.
  const [showUnverified, setShowUnverified] = useState(true);
  // NEXRAD stations overlay — show by default when "NEXRAD" or "all"
  // is selected, hide for "MRMS only" to reduce visual noise.
  const showNexradStations = source !== "MRMS";

  // Date selection model. "recent" auto-follows the most recent storm day in
  // view (the default — one storm at a time). "custom" is the rep's
  // hand-picked set: one day for a single storm, or several to overlay them
  // and see where an area was hit more than once.
  const [dateMode, setDateMode] = useState<"recent" | "custom">("recent");
  const [customDates, setCustomDates] = useState<string[]>([]);

  const [searchResults, setSearchResults] = useState<HailAtAddressResponse | null>(null);
  const [showResults, setShowResults] = useState(false);

  const [selectedStorm, setSelectedStorm] = useState<Storm | null>(null);
  const [showStormDetail, setShowStormDetail] = useState(false);

  // ── Viewport-driven storm fetch ──────────────────────────────────
  // Track the map's current bounds + zoom level. The fetch always pulls the
  // area's full history window (so the date picker can list every day that
  // hit it); rendering is then scoped to the picker's selected day(s):
  //   zoom < 5 (CONUS):           last 30 days
  //   zoom 5-7 (state/region):    last 1 year
  //   zoom > 7 (city/county):     last 5 years   — full claim window
  const [viewportBbox, setViewportBbox] = useState<[number, number, number, number]>(
    [-125, 24, -66, 50],
  );
  const [viewportZoom, setViewportZoom] = useState(4);

  useEffect(() => {
    if (!map) return;
    const onMoveEnd = () => {
      const b = map.getBounds();
      // Round to 0.1° (~11km) so small pans don't churn the API cache.
      const r = (n: number) => Math.round(n * 10) / 10;
      setViewportBbox([
        r(b.getWest()), r(b.getSouth()), r(b.getEast()), r(b.getNorth()),
      ]);
      setViewportZoom(Math.round(map.getZoom() * 10) / 10);
    };
    onMoveEnd(); // initial
    map.on("moveend", onMoveEnd);
    return () => {
      map.off("moveend", onMoveEnd);
    };
  }, [map]);

  const fromDate = useMemo(() => {
    const d = new Date();
    if (viewportZoom > 7) {
      d.setUTCFullYear(d.getUTCFullYear() - 5);
    } else if (viewportZoom > 5) {
      d.setUTCFullYear(d.getUTCFullYear() - 1);
    } else {
      d.setUTCDate(d.getUTCDate() - 30);
    }
    return d.toISOString().slice(0, 10);
  }, [viewportZoom]);

  const toDate = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1); // include today
    return d.toISOString().slice(0, 10);
  }, []);

  // Source filter goes server-side via /v1/storms?source= so we don't
  // pull rows just to drop them client-side.
  const { storms } = useStorms({
    bbox: viewportBbox,
    from: fromDate,
    to: toDate,
    limit: 200,
    includeSwaths: true,
    swathSimplify: 0.02,
    fallbackToFixtures: true,
    source: source === "all" ? null : source,
    includeUnconfirmed: showUnverified,
  });

  // Distinct UTC storm days available in the current view, newest first.
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    for (const s of storms) set.add(utcDay(s.start_time));
    return [...set].sort((a, b) => (a < b ? 1 : -1));
  }, [storms]);

  // The day(s) actually rendered. "recent" → just the newest day in view.
  const selectedDates = useMemo(() => {
    if (dateMode === "recent") {
      return availableDates.length ? [availableDates[0]] : [];
    }
    return customDates;
  }, [dateMode, availableDates, customDates]);

  const toggleDate = (day: string) => {
    setCustomDates((prev) => {
      const base =
        dateMode === "recent"
          ? availableDates.length
            ? [availableDates[0]]
            : []
          : prev;
      return base.includes(day)
        ? base.filter((d) => d !== day)
        : [...base, day];
    });
    setDateMode("custom");
  };

  // Only the storms on the selected day(s) render on the map.
  const visibleStorms = useMemo(() => {
    if (!selectedDates.length) return [];
    const set = new Set(selectedDates);
    return storms.filter((s) => set.has(utcDay(s.start_time)));
  }, [storms, selectedDates]);

  // Smooth raster surface (Phase 25) — one colorized image, scoped to the
  // selected day(s) via the `dates` param so only those storms burn in.
  const { raster: viewportRaster } = useViewportRaster({
    bbox: viewportBbox,
    from: fromDate,
    to: toDate,
    source: source === "all" ? null : source,
    minSize: size === "any" ? null : parseFloat(size),
    enabled: viewMode === "smooth" && selectedDates.length > 0,
    includeUnconfirmed: showUnverified,
    dates: selectedDates,
  });

  // When a storm is selected, isolate it: fetch just its raster and
  // filter the layers to it, so "click a date → see only that swath".
  const focusStormId = showStormDetail ? (selectedStorm?.id ?? null) : null;
  const focusedRaster = useStormRaster(
    viewMode === "smooth" ? focusStormId : null,
  );
  // In smooth mode, show the focused storm's raster when one is selected,
  // otherwise the day-scoped viewport mosaic.
  const activeRaster = focusStormId && focusedRaster ? focusedRaster : viewportRaster;

  // Fly to the selected storm so the isolated swath is actually in view.
  useEffect(() => {
    if (!map || !showStormDetail || !selectedStorm?.bbox) return;
    const b = selectedStorm.bbox;
    try {
      map.fitBounds(
        [
          [b.min_lng, b.min_lat],
          [b.max_lng, b.max_lat],
        ],
        { padding: 80, duration: 900, maxZoom: 10 },
      );
    } catch {
      /* degenerate bbox — ignore */
    }
  }, [map, showStormDetail, selectedStorm]);

  // When the rep hand-picks a single day, frame that storm. Guarded by a ref
  // so the 2-min storms refresh doesn't keep re-fitting (which would yank the
  // map out from under them). Only fires on an explicit single-day pick.
  const lastFitDayRef = useRef<string | null>(null);
  useEffect(() => {
    if (!map) return;
    if (dateMode !== "custom" || selectedDates.length !== 1) {
      if (selectedDates.length !== 1) lastFitDayRef.current = null;
      return;
    }
    const day = selectedDates[0];
    if (lastFitDayRef.current === day) return;
    const dayStorms = storms.filter((s) => utcDay(s.start_time) === day);
    if (!dayStorms.length) return;
    lastFitDayRef.current = day;
    let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
    for (const s of dayStorms) {
      if (!s.bbox) continue;
      minLng = Math.min(minLng, s.bbox.min_lng);
      minLat = Math.min(minLat, s.bbox.min_lat);
      maxLng = Math.max(maxLng, s.bbox.max_lng);
      maxLat = Math.max(maxLat, s.bbox.max_lat);
    }
    if (minLng > maxLng) return;
    try {
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 90, duration: 900, maxZoom: 11 },
      );
    } catch {
      /* ignore */
    }
  }, [map, dateMode, selectedDates, storms]);

  // Time scrubber only makes sense inside a single day (replay of one storm);
  // hide it otherwise so it's not always-on clutter.
  const singleDay = selectedDates.length === 1 ? selectedDates[0] : null;
  const scrubberStart = singleDay ? `${singleDay}T00:00:00Z` : fromDate;
  const scrubberEnd = useMemo(() => {
    if (!singleDay) return toDate;
    const d = new Date(`${singleDay}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
  }, [singleDay, toDate]);

  // Canvassing markers
  const { markers, add, update, remove } = useMarkers();
  const [dropMode, setDropMode] = useState(false);
  // Bumped by the Tools menu to start the draw-area sweep tool.
  const [sweepSignal, setSweepSignal] = useState(0);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const editingMarker = editingMarkerId
    ? markers.find((m) => m.id === editingMarkerId) ?? null
    : null;

  // Handle hand-off from the command palette (fly-to-storm)
  useEffect(() => {
    if (!map) return;
    try {
      const raw = sessionStorage.getItem("hs.flyto");
      if (!raw) return;
      const { lng, lat, zoom } = JSON.parse(raw) as { lng: number; lat: number; zoom?: number };
      sessionStorage.removeItem("hs.flyto");
      map.flyTo({ center: [lng, lat], zoom: zoom ?? 9, duration: 1100 });
    } catch {
      // ignore
    }
  }, [map]);

  // Deep-link: if ?address= is in the URL, kick off a search on mount.
  const params = useSearchParams();
  const queryAddress = params.get("address");
  useEffect(() => {
    if (!queryAddress || !map) return;
    let cancelled = false;
    void (async () => {
      const r = await searchAddress(queryAddress);
      if (!r || cancelled) return;
      // LIVE at-point lookup — same data path as a typed search. (This
      // used to hit-test demo fixtures, which could show invented storms
      // for a deep-linked address.)
      const { fetchStormsAtPoint } = await import("@/hooks/useStormsAtAddress");
      try {
        const results = await fetchStormsAtPoint(r.lat, r.lng, r.pretty);
        if (!cancelled) handleAddressSearch(results);
      } catch {
        if (!cancelled) {
          handleAddressSearch({
            lat: r.lat, lng: r.lng, address: r.pretty, storms: [], events: [],
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, queryAddress]);

  const handleAddressSearch = (data: HailAtAddressResponse) => {
    setSearchResults(data);
    setShowResults(true);
    if (map) {
      map.flyTo({ center: [data.lng, data.lat], zoom: 9, duration: 1100 });
    }
  };

  const handleMapClick = async (lat: number, lng: number) => {
    if (!dropMode) return;
    try {
      const created = await add({ lng, lat, status: "lead" });
      setEditingMarkerId(created.id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to drop marker", err);
    }
    setDropMode(false); // exit drop mode after dropping one
  };

  const scopeLabel =
    viewportZoom > 7
      ? `${availableDates.length} in this area`
      : viewportZoom > 5
      ? `${availableDates.length} this region`
      : `${availableDates.length} · 30 d`;

  return (
    <div className="relative h-full w-full">
      <HailMap
        basemap={basemap}
        dropMode={dropMode}
        onMapReady={setMap}
        onMarkerDrop={handleMapClick}
      />
      <TerritoriesLayer map={map} territories={territories} />
      <StormsLayer
        map={map}
        storms={visibleStorms}
        visible={viewMode === "cells" || viewMode === "smooth"}
        bandsHidden={viewMode === "smooth"}
        focusStormId={focusStormId}
        startTimeMin={null}
        minSizeIn={sizeFilterToMin(size)}
        startTimeMax={scrubberMs}
        onStormClick={(stormId) => {
          // While dropping a pin, a click should place the marker — not
          // hijack into the storm detail sheet.
          if (dropMode) return;
          const hit = visibleStorms.find((s) => s.id === stormId);
          if (hit) {
            setSelectedStorm(hit);
            setShowStormDetail(true);
          }
        }}
      />
      <StormsRasterLayer
        map={map}
        raster={activeRaster}
        visible={viewMode === "smooth"}
      />
      <StormsHeatmapLayer
        map={map}
        storms={visibleStorms}
        visible={viewMode === "heatmap"}
      />
      <NexradStationsLayer map={map} visible={showNexradStations} />
      <MarkersLayer
        map={map}
        markers={markers}
        onMarkerClick={(id) => setEditingMarkerId(id)}
      />

      <AddressSearch onResultsChange={handleAddressSearch} />

      {/* ── Desktop control surface ─────────────────────────────────────
          The storm-date picker is the primary panel (left); size/source/
          unverified filters fold into it. On mobile everything collapses
          into the MobileMapControls sheet. */}
      {!isMobile && (
        <>
          <StormDatePicker
            storms={storms}
            selectedDates={selectedDates}
            isRecentMode={dateMode === "recent"}
            onToggleDate={toggleDate}
            onMostRecent={() => setDateMode("recent")}
            onClear={() => {
              setDateMode("custom");
              setCustomDates([]);
            }}
            scopeLabel={scopeLabel}
            size={size}
            source={source}
            showUnverified={showUnverified}
            onSizeChange={setSize}
            onSourceChange={setSource}
            onToggleUnverified={() => setShowUnverified((v) => !v)}
          />

          <SweepTool map={map} hideTrigger startSignal={sweepSignal} />
          <MapToolsMenu
            dropActive={dropMode}
            onToggleDrop={() => setDropMode((v) => !v)}
            onDrawArea={() => setSweepSignal((n) => n + 1)}
            markerCount={markers.length}
          />

          {singleDay && (
            <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex justify-center px-4">
              <TimeScrubber
                rangeStart={scrubberStart}
                rangeEnd={scrubberEnd}
                cursorMs={scrubberMs}
                onCursorChange={setScrubberMs}
              />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-4">
            <div className="pointer-events-auto flex items-center gap-2">
              <BasemapToggle value={basemap} onChange={setBasemap} />
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
              <LegendButton />
            </div>
          </div>
        </>
      )}

      {isMobile && (
        <MobileMapControls
          viewMode={viewMode}
          onViewMode={setViewMode}
          basemap={basemap}
          onBasemap={setBasemap}
          size={size}
          onSizeChange={setSize}
          source={source}
          onSourceChange={setSource}
          selectedDates={selectedDates}
          isRecentMode={dateMode === "recent"}
          onToggleDate={toggleDate}
          onMostRecent={() => setDateMode("recent")}
          onClear={() => {
            setDateMode("custom");
            setCustomDates([]);
          }}
          showUnverified={showUnverified}
          onToggleUnverified={() => setShowUnverified((v) => !v)}
          storms={storms}
          onStormClick={(s) => {
            setSelectedStorm(s);
            setShowStormDetail(true);
          }}
        />
      )}

      {/* Mobile keeps a dedicated drop-pin pill; desktop uses the Tools menu. */}
      {isMobile && (
        <DropModeToggle
          active={dropMode}
          onToggle={() => setDropMode((v) => !v)}
          count={markers.length}
        />
      )}

      <Sheet open={showResults} onOpenChange={setShowResults}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={isMobile ? "p-0 bg-card border-t border-border max-h-[88vh] overflow-y-auto rounded-t-2xl" : "w-full sm:max-w-md p-0 bg-card border-l border-border"}
        >
          <SheetHeader className="px-6 pt-6 pb-3">
            <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
              Address lookup
            </p>
            <SheetTitle className="font-display text-2xl font-medium tracking-tight-display">
              {searchResults?.address ?? "Search results"}
            </SheetTitle>
            {searchResults && (
              <p className="text-sm text-muted-foreground font-mono-num">
                {searchResults.lat.toFixed(4)}°N, {Math.abs(searchResults.lng).toFixed(4)}°W
              </p>
            )}
          </SheetHeader>

          <div className="px-6">
            <div className="rule-atlas" />
          </div>

          {searchResults && (
            <div className="px-6 pt-4 pb-1">
              <SaveAddressButton
                address={searchResults.address}
                lat={searchResults.lat}
                lng={searchResults.lng}
                lastStormSizeIn={
                  searchResults.storms.length > 0
                    ? Math.max(...searchResults.storms.map((s) => s.max_hail_size_in))
                    : undefined
                }
                lastStormAt={
                  searchResults.storms.length > 0
                    ? searchResults.storms.reduce((latest, s) =>
                        new Date(s.start_time).getTime() > new Date(latest).getTime()
                          ? s.start_time
                          : latest,
                        searchResults.storms[0].start_time,
                      )
                    : undefined
                }
              />
            </div>
          )}

          <div className="px-6 py-5">
            {searchResults && (
              <StormList
                storms={searchResults.storms}
                onStormClick={(s) => {
                  setSelectedStorm(s);
                  setShowStormDetail(true);
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <StormDetailSheet
        storm={selectedStorm}
        isOpen={showStormDetail}
        onClose={() => setShowStormDetail(false)}
        address={searchResults?.address}
        map={map}
      />

      <MarkerEditor
        marker={editingMarker}
        isOpen={editingMarker !== null}
        onClose={() => setEditingMarkerId(null)}
        onSave={(id, patch) => update(id, patch)}
        onDelete={(id) => remove(id)}
      />

      <WelcomeTour />
    </div>
  );
}

/**
 * Compact pill toggle between the per-cell view and the density
 * heatmap. Sits next to the BasemapToggle in the bottom-center of
 * the map. Same glass pill styling as the rest of the map controls.
 */
function ViewModeToggle({
  value,
  onChange,
}: {
  value: "cells" | "smooth" | "heatmap";
  onChange: (next: "cells" | "smooth" | "heatmap") => void;
}) {
  const opts: Array<{ id: "cells" | "smooth" | "heatmap"; label: string }> = [
    { id: "smooth", label: "Smooth" },
    { id: "cells", label: "Cells" },
    { id: "heatmap", label: "Heatmap" },
  ];
  return (
    <div className="glass inline-flex items-center rounded-full p-1 shadow-panel text-xs">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={
            "px-3 py-1 rounded-full transition-colors " +
            (value === o.id
              ? "bg-primary text-primary-foreground"
              : "text-foreground/70 hover:text-foreground")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
