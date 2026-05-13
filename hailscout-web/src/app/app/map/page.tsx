"use client";

import { useEffect, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { HailAtAddressResponse, Storm } from "@/lib/api-types";
import { HailMap } from "@/components/map/HailMap";
import { BasemapToggle, type BasemapId } from "@/components/map/basemap-toggle";
import { StormsLayer } from "@/components/map/storms-layer";
import { NexradStationsLayer } from "@/components/map/nexrad-stations-layer";
import { TimeScrubber } from "@/components/map/time-scrubber";
import { useStorms } from "@/hooks/useStorms";
import { StormPicker } from "@/components/app/storm-picker";
import {
  MapFilters,
  dateFilterToCutoff,
  sizeFilterToMin,
  type DateFilter,
  type SizeFilter,
  type SourceFilter,
} from "@/components/map/map-filters";
import { SwathLegend } from "@/components/map/swath-legend";
import { MarkersLayer } from "@/components/map/markers-layer";
import { DropModeToggle } from "@/components/map/drop-mode-toggle";
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
import { StormActivityFeed } from "@/components/map/storm-activity-feed";
import { SweepTool } from "@/components/map/sweep-tool";
import { TerritoriesLayer } from "@/components/map/territories-layer";
import { useTerritories } from "@/hooks/useTerritories";
import { useSearchParams } from "next/navigation";
import { searchAddress } from "@/lib/geocode";
import { useMarkers } from "@/hooks/useMarkers";

export default function MapPage() {
  const isMobile = useIsMobile();
  const { territories } = useTerritories();
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>("atlas");
  const [date, setDate] = useState<DateFilter>("all");
  const [size, setSize] = useState<SizeFilter>("any");
  const [source, setSource] = useState<SourceFilter>("all");
  const [scrubberMs, setScrubberMs] = useState<number | null>(null);
  // NEXRAD stations overlay — show by default when "NEXRAD" or "all"
  // is selected, hide for "MRMS only" to reduce visual noise.
  const showNexradStations = source !== "MRMS";

  const [searchResults, setSearchResults] = useState<HailAtAddressResponse | null>(null);
  const [showResults, setShowResults] = useState(false);

  const [selectedStorm, setSelectedStorm] = useState<Storm | null>(null);
  const [showStormDetail, setShowStormDetail] = useState(false);

  // ── Viewport-driven storm fetch ──────────────────────────────────
  // Track the map's current bounds + zoom level. When the user zooms
  // into Colorado (or anywhere), useStorms re-fetches scoped to that
  // bbox with a zoom-appropriate date window:
  //   zoom < 5 (CONUS):           last 30 days   — fresh-events view
  //   zoom 5-7 (state/region):    last 1 year    — seasonal sweep
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
  });

  // Canvassing markers
  const { markers, add, update, remove } = useMarkers();
  const [dropMode, setDropMode] = useState(false);
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
      const { fixturesAtPoint } = await import("@/lib/storm-fixtures");
      const storms = fixturesAtPoint(r.lng, r.lat);
      handleAddressSearch({
        lat: r.lat,
        lng: r.lng,
        address: r.pretty,
        storms,
        events: [],
      });
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
        storms={storms}
        startTimeMin={dateFilterToCutoff(date)}
        minSizeIn={sizeFilterToMin(size)}
        startTimeMax={scrubberMs}
      />
      <NexradStationsLayer map={map} visible={showNexradStations} />
      <MarkersLayer
        map={map}
        markers={markers}
        onMarkerClick={(id) => setEditingMarkerId(id)}
      />

      <AddressSearch onResultsChange={handleAddressSearch} />
      <StormPicker
        map={map}
        storms={storms}
        scopeLabel={
          viewportZoom > 7
            ? "this area · 5 yr"
            : viewportZoom > 5
            ? "this region · 1 yr"
            : "Recent · 30 d"
        }
      />

      <MapFilters
        date={date}
        size={size}
        source={source}
        onDateChange={setDate}
        onSizeChange={setSize}
        onSourceChange={setSource}
      />
      <SwathLegend />

      <DropModeToggle
        active={dropMode}
        onToggle={() => setDropMode((v) => !v)}
        count={markers.length}
      />

      <StormActivityFeed map={map} />
      <SweepTool map={map} />

      <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex justify-center px-4">
        <TimeScrubber cursorMs={scrubberMs} onCursorChange={setScrubberMs} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-4">
        <BasemapToggle value={basemap} onChange={setBasemap} />
      </div>

      <Sheet open={showResults} onOpenChange={setShowResults}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={isMobile ? "p-0 bg-card border-t border-border max-h-[88vh] overflow-y-auto rounded-t-2xl" : "w-full sm:max-w-md p-0 bg-card border-l border-border"}
        >
          <SheetHeader className="px-6 pt-6 pb-3">
            <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
              Atlas search
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
