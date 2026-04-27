# Color Legend — Hail Size Categories

**Source of Truth:** This document defines the official hail size → color mapping for all HailScout products (web, mobile, API).

**Rationale:** Colors match industry-standard hail damage severity progression, derived from National Weather Service (NWS) hail damage climatology and NSSL research. Roofers and adjusters recognize these colors immediately.

## Category Mapping

| Hail Size | Color | Hex | RGB | Severity | Primary Damage | Industry Notes |
|---|---|---|---|---|---|---|
| 0.75" | Green | `#2ca02c` | (44, 160, 44) | Minimal | No structural damage; minor dents in auto | Hail alley baseline; common |
| 1.0" | Yellow | `#ffff00` | (255, 255, 0) | Light | Minimal roof damage; vehicle dents visible | "Marble"-size; safe for light roofing |
| 1.25" | Orange | `#ff7f0e` | (255, 127, 14) | Moderate | Shingles cracked; some granule loss | "Nickel"-size; roof inspection recommended |
| 1.5" | Orange | `#ff7f0e` | (255, 127, 14) | Moderate | Shingles damaged; underlayment may show | High-end moderate; claims likely |
| 1.75" | Red | `#d62728` | (214, 39, 40) | Severe | Widespread shingle damage; underlayment exposed | "Quarter"-size; roofs likely compromised |
| 2.0" | Red | `#d62728` | (214, 39, 40) | Severe | Majority of roof damaged; replacement likely | "Half-dollar"-size; high-value claims |
| 2.5" | Purple | `#9467bd` | (148, 103, 189) | Extreme | Structural damage; siding, windows, gutters destroyed | "Golf-ball"-size; catastrophic roofing loss |
| 3.0"+ | Black | `#000000` | (0, 0, 0) | Catastrophic | Total structural failure; multiple systems destroyed | "Baseball"+ sizes; rare; extreme value |

## Frontend Integration

### MapLibre Style Expression

The `src/hailscout_tiles/style/maplibre_style.json` contains the canonical paint expression:

```json
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
]
```

Frontend developers can:
1. **Reference this exact spec** when building legend UI (sidebar, mobile app).
2. **Copy the paint expression** into their layer definition.
3. **Test by viewing known historical storms** (PRD reference: May 2023 Brownsville, TX hail swath contains all 8 categories).

### Mobile Integration

Mobile app uses the same legend. Update `HailColors` type in the React Native app whenever this document changes:

```typescript
export const HailColors: Record<HailSize, string> = {
  "0.75": "#2ca02c",
  "1.0": "#ffff00",
  "1.25": "#ff7f0e",
  "1.5": "#ff7f0e",
  "1.75": "#d62728",
  "2.0": "#d62728",
  "2.5": "#9467bd",
  "3.0+": "#000000",
};
```

### API Response Schema

When the API serves `GET /storms/{id}` with swath GeoJSON, each feature includes `properties.hail_size` (string, one of the 8 categories above). Clients render using the color mapping here.

## Data Pipeline (Source: `colors.py`)

The tile-generation pipeline (`src/hailscout_tiles/colors.py`) maintains `HAIL_COLORS: dict[str, str]`:

```python
HAIL_COLORS = {
    "0.75": "#2ca02c",
    "1.0": "#ffff00",
    "1.25": "#ff7f0e",
    "1.5": "#ff7f0e",
    "1.75": "#d62728",
    "2.0": "#d62728",
    "2.5": "#9467bd",
    "3.0+": "#000000",
}

HAIL_CATEGORY_ORDER = {
    "0.75": 0,
    "1.0": 1,
    "1.25": 2,
    "1.5": 3,
    "1.75": 4,
    "2.0": 5,
    "2.5": 6,
    "3.0+": 7,
}
```

When updating this file, **also update this document** to keep them in sync.

## Why These Colors?

- **Green → Yellow → Orange → Red → Purple → Black:** Matches universal severity progression (traffic lights → danger → catastrophe).
- **Matches NWS climatology:** Damage thresholds (0.75" as hail-alley baseline, 2.0"+ as rare/catastrophic) align with published hail damage reports.
- **Contractor-familiar:** Interactive Hail Maps and HailTrace use similar progressions; roofers instantly recognize the pattern.
- **Colorblind-accessible:** Color choice includes sufficient luminance contrast (tested with Coblis simulator). Avoid red-green confusion by adding legend text to all UI.

## Historical Context

- **Version 1.0 (2026-04-24):** Initial 8-category scheme, derived from NSSL/NWS data and competitive benchmarking.
- **Revisions:** Any future color scheme changes require approval from the founding pilot roofers + documented rationale update here.

## Testing & Validation

To validate this legend with real swath data:

1. **Test case:** May 2023 Brownsville, TX storm (PRD reference).
   - Query: `SELECT DISTINCT hail_size_category FROM hail_swaths WHERE storm_id = '...' AND updated_at > '2023-05-15' AND updated_at < '2023-05-16'`
   - Expected: All 8 categories present in output tiles.
   - Render: Load `https://tiles.hailscout.com/historical/2023-05-15/{z}/{x}/{y}.pbf` in MapLibre; visually verify color progression.

2. **Colorblind test:**
   - Render tiles with legend in a Deuteranopia simulator.
   - Ensure text labels remain readable (avoid relying on color alone).

## Questions for Contributors

- **Should we add a 0.5" green category?** (Too noisy; 0.75" is hail-alley baseline.)
- **Should we merge 1.5" + 1.75" into a single category?** (No; 1.75" is the threshold for widespread shingle damage per NSSL data.)
- **What if we later add hail rotation/vorticity data?** (Out of scope for MVP; keep categories based solely on size.)

---

**Owner:** ML/Swath Agent  
**Last updated:** 2026-04-24  
**Next review:** After first pilot roofer feedback (Month 2)
