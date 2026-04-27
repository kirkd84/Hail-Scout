"use client";

import { useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { HailAtAddressResponse } from "@/lib/api-types";
import { HailMap } from "@/components/map/HailMap";
import { SwathLegend } from "@/components/map/swath-legend";
import { AddressSearch } from "@/components/app/address-search";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StormList } from "@/components/app/storm-list";
import { StormDetailSheet } from "@/components/app/storm-detail-sheet";

export default function MapPage() {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [searchResults, setSearchResults] = useState<HailAtAddressResponse | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [selectedStorm, setSelectedStorm] = useState<any>(null);
  const [showStormDetail, setShowStormDetail] = useState(false);

  const handleMapReady = (mapInstance: MapLibreMap) => {
    setMap(mapInstance);
  };

  const handleAddressSearch = (data: HailAtAddressResponse) => {
    setSearchResults(data);
    setShowResults(true);

    // Pan map to result
    if (map) {
      map.flyTo({
        center: [data.lng, data.lat],
        zoom: 10,
      });
    }
  };

  return (
    <div className="relative w-full h-full">
      <HailMap onMapReady={handleMapReady} />

      <AddressSearch onResultsChange={handleAddressSearch} />

      <SwathLegend />

      {/* Results Sheet */}
      <Sheet open={showResults} onOpenChange={setShowResults}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Search Results</SheetTitle>
            <SheetDescription>
              {searchResults?.address}
            </SheetDescription>
          </SheetHeader>

          {searchResults && (
            <div className="mt-6">
              <StormList
                storms={searchResults.storms}
                onStormClick={(storm) => {
                  setSelectedStorm(storm);
                  setShowStormDetail(true);
                }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Storm Detail Sheet */}
      <StormDetailSheet
        storm={selectedStorm}
        isOpen={showStormDetail}
        onClose={() => setShowStormDetail(false)}
      />
    </div>
  );
}
