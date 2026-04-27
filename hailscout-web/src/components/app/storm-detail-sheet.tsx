"use client";

import type { Storm } from "@/lib/api-types";
import { formatDateTime } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface StormDetailSheetProps {
  storm: Storm | null;
  isOpen: boolean;
  onClose: () => void;
}

export function StormDetailSheet({
  storm,
  isOpen,
  onClose,
}: StormDetailSheetProps) {
  if (!storm) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Storm Details</SheetTitle>
          <SheetDescription>
            {formatDateTime(storm.start_time)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div>
            <h4 className="font-semibold text-sm mb-2">Max Hail Size</h4>
            <p className="text-2xl font-bold text-primary">
              {storm.max_hail_size_in}"
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">Duration</h4>
            <p className="text-sm">
              {formatDateTime(storm.start_time)} to{" "}
              {formatDateTime(storm.end_time)}
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">Location</h4>
            <p className="text-sm">
              {storm.centroid_lat.toFixed(4)}°N, {Math.abs(storm.centroid_lng).toFixed(4)}°W
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">Source</h4>
            <p className="text-sm capitalize">
              {storm.source === "mrms" ? "Real-time MRMS" : "Historical Archive"}
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">Bounding Box</h4>
            <p className="text-xs font-mono bg-muted p-2 rounded">
              {storm.bbox.min_lat.toFixed(2)}, {storm.bbox.min_lng.toFixed(2)} to{" "}
              {storm.bbox.max_lat.toFixed(2)}, {storm.bbox.max_lng.toFixed(2)}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
