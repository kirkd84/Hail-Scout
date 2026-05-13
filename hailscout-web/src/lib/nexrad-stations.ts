/**
 * NEXRAD WSR-88D stations the Phase 18 pipeline ingests from.
 *
 * Mirrored from `hailscout-data-pipeline/src/hailscout_pipeline/ingestion/
 * nexrad_client.py:CONUS_NEXRAD_STATIONS` — same 33 hail-belt sites.
 * Web copy is hand-maintained because the station list is stable
 * (FAA-assigned ICAO codes, locations don't move) and we don't want to
 * make this a runtime API call.
 *
 * Used by NexradStationsLayer on /app/map to render dots at each site
 * so users can see *where* the sub-km radar coverage comes from once
 * Phase 18 NEXRAD ingestion is live.
 */

export interface NexradStation {
  /** ICAO code, 4 letters, e.g. "KOKC" */
  code: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  /** Approximate useful radar range (km). Most WSR-88D sites are
   *  ~250 km for reflectivity, ~150 km for clean dual-pol. We use this
   *  to optionally render a coverage halo on the map. */
  range_km?: number;
}

export const CONUS_NEXRAD_STATIONS: readonly NexradStation[] = [
  // Texas — heart of hail-alley
  { code: "KFWS", name: "Dallas / Fort Worth", state: "TX", lat: 32.573, lng:  -97.303, range_km: 250 },
  { code: "KOKC", name: "Oklahoma City",       state: "OK", lat: 35.333, lng:  -97.278, range_km: 250 },
  { code: "KTLX", name: "Twin Lakes",          state: "OK", lat: 35.333, lng:  -97.278, range_km: 250 },
  { code: "KICT", name: "Wichita",             state: "KS", lat: 37.654, lng:  -97.443, range_km: 250 },
  { code: "KDDC", name: "Dodge City",          state: "KS", lat: 37.761, lng:  -99.969, range_km: 250 },
  { code: "KFDR", name: "Frederick",           state: "OK", lat: 34.362, lng:  -98.977, range_km: 250 },
  { code: "KSGF", name: "Springfield",         state: "MO", lat: 37.235, lng:  -93.401, range_km: 250 },
  { code: "KTWX", name: "Topeka",              state: "KS", lat: 38.997, lng:  -96.232, range_km: 250 },
  { code: "KEAX", name: "Pleasant Hill",       state: "MO", lat: 38.810, lng:  -94.264, range_km: 250 },
  { code: "KARX", name: "La Crosse",           state: "WI", lat: 43.823, lng:  -91.191, range_km: 250 },
  { code: "KFSD", name: "Sioux Falls",         state: "SD", lat: 43.588, lng:  -96.729, range_km: 250 },
  { code: "KOAX", name: "Omaha",               state: "NE", lat: 41.320, lng:  -96.367, range_km: 250 },
  { code: "KDMX", name: "Des Moines",          state: "IA", lat: 41.731, lng:  -93.723, range_km: 250 },
  { code: "KAMA", name: "Amarillo",            state: "TX", lat: 35.234, lng: -101.709, range_km: 250 },
  { code: "KLBB", name: "Lubbock",             state: "TX", lat: 33.654, lng: -101.814, range_km: 250 },
  { code: "KMAF", name: "Midland",             state: "TX", lat: 31.943, lng: -102.189, range_km: 250 },
  { code: "KFTG", name: "Denver",              state: "CO", lat: 39.787, lng: -104.546, range_km: 250 },
  { code: "KPUX", name: "Pueblo",              state: "CO", lat: 38.460, lng: -104.181, range_km: 250 },
  // Southeast for late-season hail
  { code: "KBMX", name: "Birmingham",          state: "AL", lat: 33.172, lng:  -86.770, range_km: 250 },
  { code: "KFFC", name: "Atlanta",             state: "GA", lat: 33.364, lng:  -84.566, range_km: 250 },
  { code: "KOHX", name: "Nashville",           state: "TN", lat: 36.247, lng:  -86.563, range_km: 250 },
  { code: "KMRX", name: "Knoxville",           state: "TN", lat: 36.169, lng:  -83.402, range_km: 250 },
  { code: "KGWX", name: "Columbus",            state: "MS", lat: 33.897, lng:  -88.329, range_km: 250 },
  { code: "KHTX", name: "Huntsville",          state: "AL", lat: 34.931, lng:  -86.084, range_km: 250 },
  // Midwest
  { code: "KILX", name: "Lincoln",             state: "IL", lat: 40.150, lng:  -89.337, range_km: 250 },
  { code: "KIND", name: "Indianapolis",        state: "IN", lat: 39.708, lng:  -86.280, range_km: 250 },
  { code: "KLOT", name: "Chicago",             state: "IL", lat: 41.604, lng:  -88.085, range_km: 250 },
  { code: "KMKX", name: "Milwaukee",           state: "WI", lat: 42.968, lng:  -88.551, range_km: 250 },
  { code: "KIWX", name: "Northern IN",         state: "IN", lat: 41.359, lng:  -85.700, range_km: 250 },
  { code: "KLVX", name: "Louisville",          state: "KY", lat: 37.975, lng:  -85.944, range_km: 250 },
  { code: "KLSX", name: "Saint Louis",         state: "MO", lat: 38.699, lng:  -90.683, range_km: 250 },
];
