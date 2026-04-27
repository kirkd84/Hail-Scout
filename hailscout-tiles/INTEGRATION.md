# Frontend Integration Guide

## Tile Source Configuration

Add this vector tile source to your MapLibre GL JS map configuration:

```json
{
  "id": "swaths-source",
  "type": "vector",
  "tiles": [
    "https://tiles.hailscout.com/swaths/{z}/{x}/{y}.pbf",
    "https://tiles.hailscout.com/historical/{date}/{z}/{x}/{y}.pbf"
  ],
  "minzoom": 4,
  "maxzoom": 14
}
```

## Layer Configuration

Use the paint expression from `src/hailscout_tiles/style/maplibre_style.json`:

```json
{
  "id": "swaths-fill",
  "type": "fill",
  "source": "swaths-source",
  "source-layer": "swaths",
  "paint": {
    "fill-color": [
      "match",
      ["get", "hail_size"],
      "0.75", "#2ca02c",
      "1.0", "#ffff00",
      "1.25", "#ff7f0e",
      "1.5", "#ff7f0e",
      "1.75", "#d62728",
      "2.0", "#d62728",
      "2.5", "#9467bd",
      "3.0+", "#000000",
      "#cccccc"
    ],
    "fill-opacity": 0.6
  }
}
```

## Tile Feature Properties

Each feature in the `swaths` layer contains:

```typescript
interface SwathFeature {
  // Hail size category (one of 8 values)
  hail_size: "0.75" | "1.0" | "1.25" | "1.5" | "1.75" | "2.0" | "2.5" | "3.0+";

  // Numeric order for sorting (0.0 = smallest, 7.0 = largest)
  category: number;

  // Storm identifier (UUID)
  storm_id: string;

  // Storm start time (ISO 8601 UTC)
  start_time: string; // "2024-05-15T14:30:00Z"

  // Storm end time (ISO 8601 UTC)
  end_time: string; // "2024-05-15T16:45:00Z"

  // Maximum hail size in inches (float)
  max_size_in: number; // 2.5
}
```

## Current vs. Historical Tiles

### Current Tiles (`/swaths/`)

- **URL:** `https://tiles.hailscout.com/swaths/{z}/{x}/{y}.pbf`
- **Data:** Last 7 days of swaths
- **Refresh:** Every 5 minutes (refreshed by the `generate-current` job)
- **Cache TTL:** 60 seconds (via CloudFront)
- **Use case:** Real-time map display; shows active storms

### Historical Tiles (`/historical/{date}/`)

- **URL:** `https://tiles.hailscout.com/historical/{YYYY-MM-DD}/{z}/{x}/{y}.pbf`
- **Data:** All swaths for a specific date
- **Refresh:** On-demand via `generate-historical` job
- **Cache TTL:** 1 year (immutable; served with `immutable` cache header)
- **Use case:** Historical event replay; forensic analysis

## Interactivity Examples

### Click to Show Feature Details

```javascript
map.on("click", "swaths-fill", (e) => {
  const feature = e.features[0];
  const props = feature.properties;

  // Show popup or sidebar
  showStormDetails({
    hailSize: props.hail_size,
    severity: getSeverityLabel(props.hail_size),
    stormId: props.storm_id,
    startTime: props.start_time,
    endTime: props.end_time,
    maxSize: props.max_size_in,
  });
});
```

### Hover to Highlight

```javascript
let hoveredFeatureId = null;

map.on("mousemove", "swaths-fill", (e) => {
  if (e.features.length > 0) {
    // Store ID and update paint to show highlighted state
    hoveredFeatureId = e.features[0].id;
    map.setPaintProperty("swaths-fill", "fill-opacity", [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      0.8,  // Hovered
      0.6,  // Normal
    ]);
    map.setFeatureState({ source: "swaths-source", id: hoveredFeatureId }, { hover: true });
  }
});

map.on("mouseleave", "swaths-fill", () => {
  if (hoveredFeatureId !== null) {
    map.setFeatureState({ source: "swaths-source", id: hoveredFeatureId }, { hover: false });
  }
});
```

### Query Tiles by Bounding Box

```javascript
// Get all features in a bounding box
const features = map.querySourceFeatures("swaths-source", {
  sourceLayer: "swaths",
});

// Filter by property
const largeSwaths = features.filter((f) => {
  const size = parseFloat(f.properties.hail_size);
  return size >= 1.75;  // Red and larger
});
```

## Color Legend for UI

Display this legend to users (see `COLOR_LEGEND.md` for details):

```
0.75"  🟢 Green      — Minimal damage
1.0"   🟡 Yellow     — Light damage
1.25"  🟠 Orange     — Moderate damage (start)
1.5"   🟠 Orange     — Moderate damage (end)
1.75"  🔴 Red        — Severe damage (start)
2.0"   🔴 Red        — Severe damage (end)
2.5"   🟣 Purple     — Extreme damage
3.0"+  ⚫ Black      — Catastrophic damage
```

## Mobile Integration (React Native)

For MapLibre Native (mobile app), use the same tile source and paint expression:

```typescript
import MapLibreGL from "@maplibre/maplibre-react-native";

const SwathsLayer = () => (
  <>
    <MapLibreGL.VectorSource
      id="swaths-source"
      tileUrlTemplates={["https://tiles.hailscout.com/swaths/{z}/{x}/{y}.pbf"]}
      minZoomLevel={4}
      maxZoomLevel={14}
    >
      <MapLibreGL.FillLayer
        id="swaths-fill"
        sourceID="swaths-source"
        sourceLayerID="swaths"
        style={{
          fillColor: [
            "match",
            ["get", "hail_size"],
            "0.75", "#2ca02c",
            "1.0", "#ffff00",
            // ... (same as web)
          ],
          fillOpacity: 0.6,
        }}
      />
    </MapLibreGL.VectorSource>
  </>
);
```

## Performance Considerations

### Zoom Level Recommendations

- **Z 4–5:** Global view; use for outbreak overview
- **Z 6–8:** State/region; good for contractor targeting
- **Z 9–11:** County/metro; property-level planning
- **Z 12–14:** Street/property; finest detail for canvassing

Tippecanoe automatically simplifies geometries at lower zooms to keep tile size under 500KB.

### Bandwidth Optimization

- Tiles are gzip-compressed (10:1 ratio typical)
- CloudFront caches aggressively (60s for current, 1 year for historical)
- Browser caches tiles automatically
- Recommend lazy-loading historical layers (don't render until date selected)

### Data Freshness

- **Current tiles:** Refreshed every 5 minutes (from MRMS ingestion pipeline)
- **Swath appearance:** MRMS data to rendered tile typically < 6 minutes
- **Cache invalidation:** Automatic for `/swaths/` prefix; manual for historical dates

## Troubleshooting

### Tiles Not Rendering

1. Check browser console for network errors (404, 403, 5xx)
2. Verify CloudFront distribution is enabled
3. Check that S3 bucket policy allows CloudFront OAC access
4. Verify tile source URL is correct (https, not http)

### Colors Look Wrong

1. Verify `fill-color` paint expression matches `COLOR_LEGEND.md`
2. Check that `hail_size` property is being read correctly
3. Inspect a feature with dev tools: `map.queryRenderedFeatures()`

### Performance Issues

1. Check CloudFront cache hit rate (CloudWatch console)
2. Reduce number of visible layers if rendering > 5 layers
3. Use `minzoom` to hide swaths at very low zoom levels
4. Enable gzip compression on client side

## Monitoring & Alerts

Subscribe to these CloudWatch metrics:

- `CloudFront.Requests` — tile requests (should be high during storms)
- `CloudFront.BytesDownloaded` — bandwidth
- `CloudFront.CacheHitRate` — should be > 90%
- `S3.GetObject.Latency` — origin latency (alert if > 1s)

## Changelog

**Version 1.0 (2026-04-24):**
- Initial 8-category hail size legend
- Current + historical tile endpoints
- MapLibre GL JS + React Native integration examples
