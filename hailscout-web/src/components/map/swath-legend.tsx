"use client";

import { HAIL_SIZE_CATEGORIES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SwathLegend() {
  return (
    <Card className="absolute bottom-4 right-4 z-20 w-64">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Hail Size Legend</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {HAIL_SIZE_CATEGORIES.map((category) => (
          <div key={category.inches} className="flex items-center gap-3">
            <div
              className="w-6 h-6 rounded border"
              style={{ backgroundColor: category.color, opacity: 0.6 }}
            />
            <span className="text-sm">{category.label}</span>
          </div>
        ))}
        <p className="text-xs text-muted-foreground mt-4 pt-2 border-t">
          Colors from hailscout-tiles service. Update frequency: every 2 minutes during active storms.
        </p>
      </CardContent>
    </Card>
  );
}
