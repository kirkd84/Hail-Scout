"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useStormsAtAddress } from "@/hooks/useStormsAtAddress";
import { debounce } from "@/lib/utils";

interface AddressSearchProps {
  onResultsFound?: (lat: number, lng: number) => void;
  onResultsChange?: (data: any) => void;
}

export function AddressSearch({
  onResultsFound,
  onResultsChange,
}: AddressSearchProps) {
  const [address, setAddress] = useState("");
  const { data, isLoading, error, mutate } = useStormsAtAddress(
    address || undefined
  );

  const handleSearch = useCallback(
    debounce((query: string) => {
      setAddress(query);
      mutate();
    }, 500),
    [mutate]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate();

    if (data) {
      onResultsFound?.(data.lat, data.lng);
      onResultsChange?.(data);
    }
  };

  return (
    <div className="absolute top-4 left-4 z-20 bg-white rounded-lg shadow-lg p-4 max-w-sm w-full md:w-80">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          placeholder="Search address..."
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            handleSearch(e.target.value);
          }}
          disabled={isLoading}
        />

        <Button type="submit" className="w-full" disabled={isLoading || !address}>
          {isLoading ? "Searching..." : "Search"}
        </Button>

        {error && (
          <p className="text-sm text-red-600">
            Error: {error instanceof Error ? error.message : "Failed to search"}
          </p>
        )}

        {data && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">{data.address}</p>
            <p className="text-xs text-muted-foreground">
              {data.storms.length} storm(s) found
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
