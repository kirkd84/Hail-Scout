"use client";

import { useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { HailAtAddressResponse, Storm } from "@/lib/api-types";
import { HailMap } from "@/components/map/HailMap";
import { BasemapToggle, type BasemapId } from "@/components/map/basemap-toggle";
import { StormFixturesLayer } from "@/components/map/storm-fixtures-layer";
import {
  MapFilters,
  dateFilterToCutoff,
  sizeFilterToMin,
  type DateFilter,
  type SizeFilter,
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
import { useMarkers } from "@/hooks/useMarkers";

export default function MapPage() {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>("atlas");
  const [date, setDate] = useState<DateFilter>("all");
  const [size, setSize] = useState<SizeFilter>("any");

  const [searchResults, setSearchResults] = useState<HailAtAddressResponse | null>(null);
  const [showResults, setShowResults] = useState(false);

  const [selectedStorm, setSelectedStorm] = useState<Storm | null>(null);
  const [showStormDetail, setShowStormDetail] = useState(false);

  // Canvassing markers
  const { markers, add, update, remove } = useMarkers();
  const [dropMode, setDropMode] = useState(false);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const editingMarker = editingMarkerId
    ? markers.find((m) => m.id === editingMarkerId) ?? null
    : null;

  const handleAddressSearch = (data: HailAtAddressResponse) => {
    setSearchResults(data);
    setShowResults(true);
    if (map) {
      map.flyTo({ center: [data.lng, data.lat], zoom: 9, duration: 1100 });
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (!dropMode) return;
    const created = add({ lng, lat, status: "lead" });
    setEditingMarkerId(created.id);
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
      <StormFixturesLayer
        map={map}
        startTimeMin={dateFilterToCutoff(date)}
        minSizeIn={sizeFilterToMin(size)}
      />
      <MarkersLayer
        map={map}
        markers={markers}
        onMarkerClick={(id) => setEditingMarkerId(id)}
      />

      <AddressSearch onResultsChange={handleAddressSearch} />

      <MapFilters date={date} size={size} onDateChange={setDate} onSizeChange={setSize} />
      <SwathLegend />

      <DropModeToggle
        active={dropMode}
        onToggle={() => setDropMode((v) => !v)}
        count={markers.length}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-4">
        <BasemapToggle value={basemap} onChange={setBasemap} />
      </div>

      <Sheet open={showResults} onOpenChange={setShowResults}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 bg-card border-l border-border"
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
      />

      <MarkerEditor
        marker={editingMarker}
        isOpen={editingMarker !== null}
        onClose={() => setEditingMarkerId(null)}
        onSave={(id, patch) => update(id, patch)}
        onDelete={(id) => remove(id)}
      />
    </div>
  );
}
