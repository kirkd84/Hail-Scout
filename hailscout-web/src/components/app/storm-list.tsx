"use client";

import type { Storm } from "@/lib/api-types";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface StormListProps {
  storms: Storm[];
  onStormClick?: (storm: Storm) => void;
}

export function StormList({ storms, onStormClick }: StormListProps) {
  if (storms.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No storms found for this location</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-lg">Storms at Location</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {storms.map((storm) => (
          <div
            key={storm.id}
            className="p-3 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
            onClick={() => onStormClick?.(storm)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-medium">
                  {formatDateTime(storm.start_time)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Max hail: {storm.max_hail_size_in}"
                </p>
              </div>
              <Badge variant={storm.source === "mrms" ? "default" : "secondary"}>
                {storm.source === "mrms" ? "Live" : "Historical"}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
