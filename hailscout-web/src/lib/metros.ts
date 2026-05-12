/**
 * Static lookup of major US metro areas with their center coordinates,
 * used to label storm centroids with "nearest city" — same UX trick
 * HailTrace / IHM use on their public storm gallery.
 *
 * Scope: ~60 metros across the US hail belt + adjacent regions. If the
 * nearest centroid is more than NEAREST_METRO_FALLBACK_MILES away, we
 * fall back to the state-level region label so the card reads
 * "Western Plains" rather than "near Houston" when a storm sits in
 * the middle of Wyoming.
 */

export interface Metro {
  name: string;
  state: string;
  lat: number;
  lng: number;
}

export const METROS: readonly Metro[] = [
  // Texas — heart of hail alley
  { name: "Dallas",         state: "TX", lat: 32.78, lng:  -96.80 },
  { name: "Fort Worth",     state: "TX", lat: 32.76, lng:  -97.33 },
  { name: "Houston",        state: "TX", lat: 29.76, lng:  -95.37 },
  { name: "Austin",         state: "TX", lat: 30.27, lng:  -97.74 },
  { name: "San Antonio",    state: "TX", lat: 29.42, lng:  -98.49 },
  { name: "Amarillo",       state: "TX", lat: 35.22, lng: -101.83 },
  { name: "Lubbock",        state: "TX", lat: 33.58, lng: -101.86 },
  { name: "El Paso",        state: "TX", lat: 31.76, lng: -106.49 },
  { name: "Midland",        state: "TX", lat: 31.99, lng: -102.08 },
  { name: "Waco",           state: "TX", lat: 31.55, lng:  -97.15 },
  { name: "Tyler",          state: "TX", lat: 32.35, lng:  -95.30 },
  { name: "Abilene",        state: "TX", lat: 32.45, lng:  -99.73 },
  // Oklahoma
  { name: "Oklahoma City",  state: "OK", lat: 35.47, lng:  -97.50 },
  { name: "Tulsa",          state: "OK", lat: 36.15, lng:  -95.99 },
  { name: "Norman",         state: "OK", lat: 35.22, lng:  -97.44 },
  // Kansas / Nebraska
  { name: "Wichita",        state: "KS", lat: 37.69, lng:  -97.34 },
  { name: "Topeka",         state: "KS", lat: 39.05, lng:  -95.68 },
  { name: "Dodge City",     state: "KS", lat: 37.75, lng: -100.02 },
  { name: "Kansas City",    state: "MO", lat: 39.10, lng:  -94.58 },
  { name: "Omaha",          state: "NE", lat: 41.26, lng:  -95.93 },
  { name: "Lincoln",        state: "NE", lat: 40.81, lng:  -96.70 },
  { name: "Grand Island",   state: "NE", lat: 40.92, lng:  -98.34 },
  // Colorado / Wyoming / New Mexico
  { name: "Denver",         state: "CO", lat: 39.74, lng: -104.99 },
  { name: "Colorado Springs", state: "CO", lat: 38.83, lng: -104.82 },
  { name: "Pueblo",         state: "CO", lat: 38.25, lng: -104.61 },
  { name: "Cheyenne",       state: "WY", lat: 41.14, lng: -104.82 },
  { name: "Albuquerque",    state: "NM", lat: 35.08, lng: -106.65 },
  // Iowa / Minnesota / Dakotas
  { name: "Des Moines",     state: "IA", lat: 41.59, lng:  -93.62 },
  { name: "Cedar Rapids",   state: "IA", lat: 41.98, lng:  -91.66 },
  { name: "Davenport",      state: "IA", lat: 41.52, lng:  -90.58 },
  { name: "Minneapolis",    state: "MN", lat: 44.98, lng:  -93.27 },
  { name: "Saint Paul",     state: "MN", lat: 44.95, lng:  -93.09 },
  { name: "Sioux Falls",    state: "SD", lat: 43.55, lng:  -96.73 },
  { name: "Rapid City",     state: "SD", lat: 44.08, lng: -103.23 },
  { name: "Fargo",          state: "ND", lat: 46.88, lng:  -96.79 },
  { name: "Bismarck",       state: "ND", lat: 46.81, lng: -100.78 },
  // Missouri / Illinois / Arkansas
  { name: "Saint Louis",    state: "MO", lat: 38.63, lng:  -90.20 },
  { name: "Springfield",    state: "MO", lat: 37.21, lng:  -93.30 },
  { name: "Chicago",        state: "IL", lat: 41.88, lng:  -87.63 },
  { name: "Peoria",         state: "IL", lat: 40.69, lng:  -89.59 },
  { name: "Little Rock",    state: "AR", lat: 34.75, lng:  -92.29 },
  { name: "Fort Smith",     state: "AR", lat: 35.39, lng:  -94.40 },
  // Tennessee / Kentucky / Indiana / Ohio
  { name: "Memphis",        state: "TN", lat: 35.15, lng:  -90.05 },
  { name: "Nashville",      state: "TN", lat: 36.16, lng:  -86.78 },
  { name: "Knoxville",      state: "TN", lat: 35.96, lng:  -83.92 },
  { name: "Louisville",     state: "KY", lat: 38.25, lng:  -85.76 },
  { name: "Indianapolis",   state: "IN", lat: 39.77, lng:  -86.16 },
  { name: "Cincinnati",     state: "OH", lat: 39.10, lng:  -84.51 },
  { name: "Columbus",       state: "OH", lat: 39.96, lng:  -82.99 },
  { name: "Cleveland",      state: "OH", lat: 41.50, lng:  -81.69 },
  // Southeast
  { name: "Birmingham",     state: "AL", lat: 33.52, lng:  -86.80 },
  { name: "Atlanta",        state: "GA", lat: 33.75, lng:  -84.39 },
  { name: "Charlotte",      state: "NC", lat: 35.23, lng:  -80.84 },
  { name: "Raleigh",        state: "NC", lat: 35.78, lng:  -78.64 },
  { name: "Jackson",        state: "MS", lat: 32.30, lng:  -90.18 },
  { name: "Tallahassee",    state: "FL", lat: 30.44, lng:  -84.28 },
  { name: "Jacksonville",   state: "FL", lat: 30.33, lng:  -81.65 },
  { name: "Orlando",        state: "FL", lat: 28.54, lng:  -81.38 },
  { name: "Tampa",          state: "FL", lat: 27.95, lng:  -82.46 },
  // Mid-Atlantic / Northeast
  { name: "Washington",     state: "DC", lat: 38.91, lng:  -77.04 },
  { name: "Philadelphia",   state: "PA", lat: 39.95, lng:  -75.17 },
  { name: "Pittsburgh",     state: "PA", lat: 40.44, lng:  -79.99 },
  { name: "New York",       state: "NY", lat: 40.71, lng:  -74.01 },
  { name: "Boston",         state: "MA", lat: 42.36, lng:  -71.06 },
];

/** Approximate-mile threshold below which we tag a storm with a metro name.
 * Beyond this we fall back to a coarser regional label (e.g. "Northern
 * Plains"). 75 mi is roughly the radius of a metro media market. */
export const NEAREST_METRO_FALLBACK_MILES = 75;

const MILES_PER_DEG_LAT = 69.0;

/** Approx Haversine in degrees — fast and accurate enough at CONUS scale. */
function approxMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat1 - lat2) * MILES_PER_DEG_LAT;
  // Cheap longitude-to-miles correction at the mean latitude.
  const meanLatRad = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dLng = (lng1 - lng2) * MILES_PER_DEG_LAT * Math.cos(meanLatRad);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** Coarse region buckets used when no metro is close. */
function regionFallback(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "United States";
  let ns = "";
  if (lat >= 41) ns = "Northern";
  else if (lat >= 36) ns = "Central";
  else ns = "Southern";
  let ew = "";
  if (lng <= -105) ew = "Rockies";
  else if (lng <= -95) ew = "Plains";
  else if (lng <= -85) ew = "Midwest";
  else ew = "East";
  return `${ns} ${ew}`;
}

export interface NearestMetroResult {
  /** "Dallas, TX" if within range, otherwise "Central Plains" etc. */
  label: string;
  /** Distance to the nearest metro in miles. Infinity for the fallback. */
  miles: number;
  /** The matched metro, or null if we fell back to a region label. */
  metro: Metro | null;
}

/**
 * Find the nearest metro to a (lat, lng). Returns a label suitable for
 * showing in a storm card.
 */
export function nearestMetro(lat: number, lng: number): NearestMetroResult {
  let best: Metro | null = null;
  let bestMiles = Infinity;
  for (const m of METROS) {
    const miles = approxMiles(lat, lng, m.lat, m.lng);
    if (miles < bestMiles) {
      bestMiles = miles;
      best = m;
    }
  }
  if (best && bestMiles <= NEAREST_METRO_FALLBACK_MILES) {
    return { label: `${best.name}, ${best.state}`, miles: bestMiles, metro: best };
  }
  return { label: regionFallback(lat, lng), miles: Infinity, metro: null };
}
