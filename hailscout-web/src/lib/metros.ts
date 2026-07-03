/**
 * Static lookup of US metro areas, used to label a storm (or a point) with
 * a recognizable "nearest city" — the same UX trick HailTrace / IHM use on
 * their public storm galleries.
 *
 * Two lookup modes (see `nearestMetro`):
 *   • plain nearest  — for a point under the cursor ("what town is this?").
 *   • weighted       — for labeling a whole storm, where a bigger, more
 *                      recognizable metro should win over a tiny town that
 *                      happens to be a few miles closer (Greeley, not
 *                      Cheyenne, for a northern-Colorado storm).
 *
 * Scope: ~190 metros — roughly the top US metro areas by population, plus a
 * denser Front Range cluster (Roof Technologies' home turf). `popK` is the
 * metro-area population in THOUSANDS; only the relative ordering matters for
 * the weighting, so the figures are approximate.
 */

export interface Metro {
  name: string;
  state: string;
  lat: number;
  lng: number;
  /** Metro-area population in thousands (approx; used only for weighting). */
  popK: number;
}

export const METROS: readonly Metro[] = [
  // ── Northeast / Mid-Atlantic ──────────────────────────────────────
  { name: "New York",       state: "NY", lat: 40.71, lng:  -74.01, popK: 19900 },
  { name: "Philadelphia",   state: "PA", lat: 39.95, lng:  -75.17, popK:  6200 },
  { name: "Boston",         state: "MA", lat: 42.36, lng:  -71.06, popK:  4900 },
  { name: "Washington",     state: "DC", lat: 38.91, lng:  -77.04, popK:  6300 },
  { name: "Baltimore",      state: "MD", lat: 39.29, lng:  -76.61, popK:  2800 },
  { name: "Pittsburgh",     state: "PA", lat: 40.44, lng:  -79.99, popK:  2300 },
  { name: "Providence",     state: "RI", lat: 41.82, lng:  -71.41, popK:  1680 },
  { name: "Hartford",       state: "CT", lat: 41.76, lng:  -72.69, popK:  1210 },
  { name: "Buffalo",        state: "NY", lat: 42.89, lng:  -78.88, popK:  1160 },
  { name: "Rochester",      state: "NY", lat: 43.16, lng:  -77.61, popK:  1090 },
  { name: "Bridgeport",     state: "CT", lat: 41.18, lng:  -73.20, popK:   950 },
  { name: "Albany",         state: "NY", lat: 42.65, lng:  -73.76, popK:   900 },
  { name: "New Haven",      state: "CT", lat: 41.31, lng:  -72.93, popK:   860 },
  { name: "Allentown",      state: "PA", lat: 40.60, lng:  -75.49, popK:   860 },
  { name: "Worcester",      state: "MA", lat: 42.26, lng:  -71.80, popK:   980 },
  { name: "Springfield",    state: "MA", lat: 42.10, lng:  -72.59, popK:   700 },
  { name: "Harrisburg",     state: "PA", lat: 40.27, lng:  -76.88, popK:   590 },
  { name: "Scranton",       state: "PA", lat: 41.41, lng:  -75.66, popK:   560 },
  { name: "Syracuse",       state: "NY", lat: 43.05, lng:  -76.15, popK:   650 },
  { name: "Portland",       state: "ME", lat: 43.66, lng:  -70.26, popK:   550 },
  { name: "Lancaster",      state: "PA", lat: 40.04, lng:  -76.31, popK:   550 },
  { name: "Manchester",     state: "NH", lat: 42.99, lng:  -71.46, popK:   420 },
  { name: "Reading",        state: "PA", lat: 40.34, lng:  -75.93, popK:   420 },
  { name: "York",           state: "PA", lat: 39.96, lng:  -76.73, popK:   460 },
  { name: "Trenton",        state: "NJ", lat: 40.22, lng:  -74.76, popK:   380 },
  { name: "Erie",           state: "PA", lat: 42.13, lng:  -80.09, popK:   270 },
  { name: "Binghamton",     state: "NY", lat: 42.10, lng:  -75.91, popK:   240 },
  // ── Southeast ─────────────────────────────────────────────────────
  { name: "Atlanta",        state: "GA", lat: 33.75, lng:  -84.39, popK:  6100 },
  { name: "Miami",          state: "FL", lat: 25.77, lng:  -80.19, popK:  6200 },
  { name: "Tampa",          state: "FL", lat: 27.95, lng:  -82.46, popK:  3200 },
  { name: "Orlando",        state: "FL", lat: 28.54, lng:  -81.38, popK:  2700 },
  { name: "Charlotte",      state: "NC", lat: 35.23, lng:  -80.84, popK:  2700 },
  { name: "Jacksonville",   state: "FL", lat: 30.33, lng:  -81.66, popK:  1600 },
  { name: "Raleigh",        state: "NC", lat: 35.79, lng:  -78.64, popK:  1450 },
  { name: "Richmond",       state: "VA", lat: 37.54, lng:  -77.44, popK:  1310 },
  { name: "Virginia Beach", state: "VA", lat: 36.85, lng:  -75.98, popK:  1800 },
  { name: "Birmingham",     state: "AL", lat: 33.52, lng:  -86.80, popK:  1110 },
  { name: "Greenville",     state: "SC", lat: 34.85, lng:  -82.39, popK:   940 },
  { name: "Knoxville",      state: "TN", lat: 35.96, lng:  -83.92, popK:   900 },
  { name: "Columbia",       state: "SC", lat: 34.00, lng:  -81.03, popK:   830 },
  { name: "Charleston",     state: "SC", lat: 32.78, lng:  -79.93, popK:   800 },
  { name: "Greensboro",     state: "NC", lat: 36.07, lng:  -79.79, popK:   780 },
  { name: "Cape Coral",     state: "FL", lat: 26.56, lng:  -81.95, popK:   790 },
  { name: "Sarasota",       state: "FL", lat: 27.34, lng:  -82.53, popK:   860 },
  { name: "Lakeland",       state: "FL", lat: 28.04, lng:  -81.95, popK:   750 },
  { name: "Winston-Salem",  state: "NC", lat: 36.10, lng:  -80.24, popK:   680 },
  { name: "Augusta",        state: "GA", lat: 33.47, lng:  -81.97, popK:   620 },
  { name: "Palm Bay",       state: "FL", lat: 28.03, lng:  -80.59, popK:   620 },
  { name: "Chattanooga",    state: "TN", lat: 35.05, lng:  -85.31, popK:   570 },
  { name: "Durham",         state: "NC", lat: 35.99, lng:  -78.90, popK:   560 },
  { name: "Nashville",      state: "TN", lat: 36.16, lng:  -86.78, popK:  2010 },
  { name: "Memphis",        state: "TN", lat: 35.15, lng:  -90.05, popK:  1340 },
  { name: "Pensacola",      state: "FL", lat: 30.42, lng:  -87.22, popK:   510 },
  { name: "Myrtle Beach",   state: "SC", lat: 33.69, lng:  -78.89, popK:   490 },
  { name: "Huntsville",     state: "AL", lat: 34.73, lng:  -86.59, popK:   490 },
  { name: "Asheville",      state: "NC", lat: 35.60, lng:  -82.55, popK:   470 },
  { name: "Mobile",         state: "AL", lat: 30.69, lng:  -88.04, popK:   430 },
  { name: "Savannah",       state: "GA", lat: 32.08, lng:  -81.09, popK:   400 },
  { name: "Tallahassee",    state: "FL", lat: 30.44, lng:  -84.28, popK:   390 },
  { name: "Naples",         state: "FL", lat: 26.14, lng:  -81.79, popK:   380 },
  { name: "Ocala",          state: "FL", lat: 29.19, lng:  -82.14, popK:   380 },
  { name: "Fayetteville",   state: "NC", lat: 35.05, lng:  -78.88, popK:   390 },
  { name: "Montgomery",     state: "AL", lat: 32.37, lng:  -86.30, popK:   370 },
  { name: "Wilmington",     state: "NC", lat: 34.23, lng:  -77.94, popK:   300 },
  { name: "Roanoke",        state: "VA", lat: 37.27, lng:  -79.94, popK:   310 },
  { name: "Gainesville",    state: "FL", lat: 29.65, lng:  -82.32, popK:   340 },
  { name: "Columbus",       state: "GA", lat: 32.46, lng:  -84.99, popK:   320 },
  { name: "Macon",          state: "GA", lat: 32.84, lng:  -83.63, popK:   230 },
  { name: "Tuscaloosa",     state: "AL", lat: 33.21, lng:  -87.57, popK:   270 },
  { name: "Hickory",        state: "NC", lat: 35.73, lng:  -81.34, popK:   370 },
  { name: "Kingsport",      state: "TN", lat: 36.55, lng:  -82.56, popK:   310 },
  { name: "Lynchburg",      state: "VA", lat: 37.41, lng:  -79.14, popK:   260 },
  { name: "Athens",         state: "GA", lat: 33.96, lng:  -83.38, popK:   220 },
  { name: "Charlottesville", state: "VA", lat: 38.03, lng: -78.48, popK:   220 },
  { name: "Salisbury",      state: "MD", lat: 38.36, lng:  -75.60, popK:   400 },
  // ── Gulf / South Central ──────────────────────────────────────────
  { name: "Houston",        state: "TX", lat: 29.76, lng:  -95.37, popK:  7300 },
  { name: "Dallas",         state: "TX", lat: 32.78, lng:  -96.80, popK:  7900 },
  { name: "Fort Worth",     state: "TX", lat: 32.76, lng:  -97.33, popK:  2600 },
  { name: "San Antonio",    state: "TX", lat: 29.42, lng:  -98.49, popK:  2600 },
  { name: "Austin",         state: "TX", lat: 30.27, lng:  -97.74, popK:  2300 },
  { name: "New Orleans",    state: "LA", lat: 29.95, lng:  -90.07, popK:  1270 },
  { name: "Oklahoma City",  state: "OK", lat: 35.47, lng:  -97.52, popK:  1440 },
  { name: "Tulsa",          state: "OK", lat: 36.15, lng:  -95.99, popK:  1020 },
  { name: "Baton Rouge",    state: "LA", lat: 30.45, lng:  -91.19, popK:   870 },
  { name: "El Paso",        state: "TX", lat: 31.76, lng: -106.49, popK:   870 },
  { name: "McAllen",        state: "TX", lat: 26.20, lng:  -98.23, popK:   890 },
  { name: "Little Rock",    state: "AR", lat: 34.75, lng:  -92.29, popK:   750 },
  { name: "Lafayette",      state: "LA", lat: 30.22, lng:  -92.02, popK:   480 },
  { name: "Shreveport",     state: "LA", lat: 32.53, lng:  -93.75, popK:   390 },
  { name: "Corpus Christi", state: "TX", lat: 27.80, lng:  -97.40, popK:   430 },
  { name: "Killeen",        state: "TX", lat: 31.12, lng:  -97.73, popK:   460 },
  { name: "Beaumont",       state: "TX", lat: 30.08, lng:  -94.13, popK:   390 },
  { name: "Jackson",        state: "MS", lat: 32.30, lng:  -90.18, popK:   590 },
  { name: "Gulfport",       state: "MS", lat: 30.37, lng:  -89.09, popK:   420 },
  { name: "Fayetteville",   state: "AR", lat: 36.06, lng:  -94.16, popK:   560 },
  { name: "Fort Smith",     state: "AR", lat: 35.39, lng:  -94.40, popK:   300 },
  { name: "Waco",           state: "TX", lat: 31.55, lng:  -97.15, popK:   280 },
  { name: "College Station", state: "TX", lat: 30.63, lng: -96.33, popK:   270 },
  { name: "Lubbock",        state: "TX", lat: 33.58, lng: -101.86, popK:   320 },
  { name: "Amarillo",       state: "TX", lat: 35.22, lng: -101.83, popK:   270 },
  { name: "Tyler",          state: "TX", lat: 32.35, lng:  -95.30, popK:   230 },
  { name: "Wichita Falls",  state: "TX", lat: 33.91, lng:  -98.49, popK:   150 },
  { name: "Abilene",        state: "TX", lat: 32.45, lng:  -99.73, popK:   170 },
  { name: "Midland",        state: "TX", lat: 31.99, lng: -102.08, popK:   180 },
  // ── Midwest ───────────────────────────────────────────────────────
  { name: "Chicago",        state: "IL", lat: 41.88, lng:  -87.63, popK:  9400 },
  { name: "Detroit",        state: "MI", lat: 42.33, lng:  -83.05, popK:  4300 },
  { name: "Minneapolis",    state: "MN", lat: 44.98, lng:  -93.27, popK:  3700 },
  { name: "St. Louis",      state: "MO", lat: 38.63, lng:  -90.20, popK:  2800 },
  { name: "Cincinnati",     state: "OH", lat: 39.10, lng:  -84.51, popK:  2260 },
  { name: "Kansas City",    state: "MO", lat: 39.10, lng:  -94.58, popK:  2190 },
  { name: "Columbus",       state: "OH", lat: 39.96, lng:  -82.99, popK:  2140 },
  { name: "Indianapolis",   state: "IN", lat: 39.77, lng:  -86.16, popK:  2110 },
  { name: "Cleveland",      state: "OH", lat: 41.50, lng:  -81.69, popK:  2050 },
  { name: "Milwaukee",      state: "WI", lat: 43.04, lng:  -87.91, popK:  1570 },
  { name: "Grand Rapids",   state: "MI", lat: 42.96, lng:  -85.67, popK:  1080 },
  { name: "Omaha",          state: "NE", lat: 41.26, lng:  -95.93, popK:   970 },
  { name: "Dayton",         state: "OH", lat: 39.76, lng:  -84.19, popK:   810 },
  { name: "Des Moines",     state: "IA", lat: 41.59, lng:  -93.62, popK:   710 },
  { name: "Akron",          state: "OH", lat: 41.08, lng:  -81.52, popK:   700 },
  { name: "Wichita",        state: "KS", lat: 37.69, lng:  -97.34, popK:   640 },
  { name: "Toledo",         state: "OH", lat: 41.66, lng:  -83.56, popK:   600 },
  { name: "Madison",        state: "WI", lat: 43.07, lng:  -89.40, popK:   680 },
  { name: "Springfield",    state: "MO", lat: 37.21, lng:  -93.30, popK:   480 },
  { name: "Fort Wayne",     state: "IN", lat: 41.08, lng:  -85.14, popK:   480 },
  { name: "Lansing",        state: "MI", lat: 42.73, lng:  -84.56, popK:   540 },
  { name: "Peoria",         state: "IL", lat: 40.69, lng:  -89.59, popK:   400 },
  { name: "Rockford",       state: "IL", lat: 42.27, lng:  -89.09, popK:   340 },
  { name: "Flint",          state: "MI", lat: 43.01, lng:  -83.69, popK:   400 },
  { name: "Canton",         state: "OH", lat: 40.80, lng:  -81.38, popK:   400 },
  { name: "Ann Arbor",      state: "MI", lat: 42.28, lng:  -83.74, popK:   370 },
  { name: "Evansville",     state: "IN", lat: 37.97, lng:  -87.57, popK:   320 },
  { name: "Kalamazoo",      state: "MI", lat: 42.29, lng:  -85.59, popK:   340 },
  { name: "South Bend",     state: "IN", lat: 41.68, lng:  -86.25, popK:   320 },
  { name: "Cedar Rapids",   state: "IA", lat: 41.98, lng:  -91.67, popK:   280 },
  { name: "Green Bay",      state: "WI", lat: 44.51, lng:  -88.02, popK:   330 },
  { name: "Davenport",      state: "IA", lat: 41.52, lng:  -90.58, popK:   380 },
  { name: "Duluth",         state: "MN", lat: 46.79, lng:  -92.10, popK:   290 },
  { name: "Topeka",         state: "KS", lat: 39.05, lng:  -95.68, popK:   230 },
  { name: "Lincoln",        state: "NE", lat: 40.81, lng:  -96.70, popK:   340 },
  { name: "Champaign",      state: "IL", lat: 40.12, lng:  -88.24, popK:   240 },
  { name: "Springfield",    state: "IL", lat: 39.80, lng:  -89.64, popK:   210 },
  { name: "Bloomington",    state: "IL", lat: 40.48, lng:  -88.99, popK:   190 },
  { name: "Rochester",      state: "MN", lat: 44.02, lng:  -92.46, popK:   220 },
  { name: "St. Cloud",      state: "MN", lat: 45.56, lng:  -94.16, popK:   200 },
  { name: "Sioux City",     state: "IA", lat: 42.50, lng:  -96.40, popK:   150 },
  { name: "Grand Island",   state: "NE", lat: 40.92, lng:  -98.34, popK:    85 },
  { name: "Dodge City",     state: "KS", lat: 37.75, lng: -100.02, popK:    35 },
  // ── Mountain / Great Plains ───────────────────────────────────────
  { name: "Denver",         state: "CO", lat: 39.74, lng: -104.99, popK:  2963 },
  { name: "Aurora",         state: "CO", lat: 39.73, lng: -104.83, popK:   390 },
  { name: "Boulder",        state: "CO", lat: 40.01, lng: -105.27, popK:   330 },
  { name: "Longmont",       state: "CO", lat: 40.17, lng: -105.10, popK:   100 },
  { name: "Loveland",       state: "CO", lat: 40.40, lng: -105.08, popK:    80 },
  { name: "Greeley",        state: "CO", lat: 40.42, lng: -104.71, popK:   330 },
  { name: "Fort Collins",   state: "CO", lat: 40.59, lng: -105.08, popK:   360 },
  { name: "Colorado Springs", state: "CO", lat: 38.83, lng: -104.82, popK:  760 },
  { name: "Pueblo",         state: "CO", lat: 38.25, lng: -104.61, popK:   170 },
  { name: "Grand Junction", state: "CO", lat: 39.06, lng: -108.55, popK:   155 },
  { name: "Cheyenne",       state: "WY", lat: 41.14, lng: -104.82, popK:   100 },
  { name: "Laramie",        state: "WY", lat: 41.31, lng: -105.59, popK:    40 },
  { name: "Casper",         state: "WY", lat: 42.87, lng: -106.31, popK:    80 },
  { name: "Phoenix",        state: "AZ", lat: 33.45, lng: -112.07, popK:  4900 },
  { name: "Tucson",         state: "AZ", lat: 32.22, lng: -110.97, popK:  1050 },
  { name: "Las Vegas",      state: "NV", lat: 36.17, lng: -115.14, popK:  2300 },
  { name: "Salt Lake City", state: "UT", lat: 40.76, lng: -111.89, popK:  1260 },
  { name: "Albuquerque",    state: "NM", lat: 35.08, lng: -106.65, popK:   920 },
  { name: "Ogden",          state: "UT", lat: 41.22, lng: -111.97, popK:   690 },
  { name: "Provo",          state: "UT", lat: 40.23, lng: -111.66, popK:   660 },
  { name: "Boise",          state: "ID", lat: 43.62, lng: -116.21, popK:   770 },
  { name: "Reno",           state: "NV", lat: 39.53, lng: -119.81, popK:   500 },
  { name: "Prescott",       state: "AZ", lat: 34.54, lng: -112.47, popK:   240 },
  { name: "Las Cruces",     state: "NM", lat: 32.31, lng: -106.78, popK:   220 },
  { name: "Yuma",           state: "AZ", lat: 32.69, lng: -114.63, popK:   210 },
  { name: "Billings",       state: "MT", lat: 45.79, lng: -108.50, popK:   190 },
  { name: "Bismarck",       state: "ND", lat: 46.81, lng: -100.78, popK:   135 },
  { name: "Fargo",          state: "ND", lat: 46.88, lng:  -96.79, popK:   250 },
  { name: "Sioux Falls",    state: "SD", lat: 43.55, lng:  -96.73, popK:   280 },
  { name: "Rapid City",     state: "SD", lat: 44.08, lng: -103.23, popK:   145 },
  // ── West Coast / Pacific ──────────────────────────────────────────
  { name: "Los Angeles",    state: "CA", lat: 34.05, lng: -118.24, popK: 12900 },
  { name: "San Francisco",  state: "CA", lat: 37.77, lng: -122.42, popK:  4700 },
  { name: "Riverside",      state: "CA", lat: 33.95, lng: -117.40, popK:  4600 },
  { name: "San Diego",      state: "CA", lat: 32.72, lng: -117.16, popK:  3300 },
  { name: "Seattle",        state: "WA", lat: 47.61, lng: -122.33, popK:  4000 },
  { name: "Sacramento",     state: "CA", lat: 38.58, lng: -121.49, popK:  2400 },
  { name: "Portland",       state: "OR", lat: 45.52, lng: -122.68, popK:  2500 },
  { name: "San Jose",       state: "CA", lat: 37.34, lng: -121.89, popK:  2000 },
  { name: "Fresno",         state: "CA", lat: 36.74, lng: -119.79, popK:  1010 },
  { name: "Bakersfield",    state: "CA", lat: 35.37, lng: -119.02, popK:   910 },
  { name: "Oxnard",         state: "CA", lat: 34.20, lng: -119.18, popK:   840 },
  { name: "Stockton",       state: "CA", lat: 37.96, lng: -121.29, popK:   780 },
  { name: "Spokane",        state: "WA", lat: 47.66, lng: -117.43, popK:   590 },
  { name: "Modesto",        state: "CA", lat: 37.64, lng: -120.99, popK:   550 },
  { name: "Santa Rosa",     state: "CA", lat: 38.44, lng: -122.71, popK:   490 },
  { name: "Visalia",        state: "CA", lat: 36.33, lng: -119.29, popK:   470 },
  { name: "Vallejo",        state: "CA", lat: 38.10, lng: -122.26, popK:   450 },
  { name: "Santa Barbara",  state: "CA", lat: 34.42, lng: -119.70, popK:   450 },
  { name: "Salinas",        state: "CA", lat: 36.68, lng: -121.66, popK:   440 },
  { name: "Eugene",         state: "OR", lat: 44.05, lng: -123.09, popK:   380 },
  { name: "Salem",          state: "OR", lat: 44.94, lng: -123.04, popK:   430 },
  { name: "Merced",         state: "CA", lat: 37.30, lng: -120.48, popK:   290 },
  { name: "Redding",        state: "CA", lat: 40.59, lng: -122.39, popK:   180 },
  { name: "Chico",          state: "CA", lat: 39.73, lng: -121.84, popK:   210 },
  { name: "Bend",           state: "OR", lat: 44.06, lng: -121.31, popK:   200 },
  { name: "Yakima",         state: "WA", lat: 46.60, lng: -120.51, popK:   250 },
  { name: "Kennewick",      state: "WA", lat: 46.21, lng: -119.14, popK:   300 },
  { name: "Olympia",        state: "WA", lat: 47.04, lng: -122.90, popK:   290 },
  { name: "Bellingham",     state: "WA", lat: 48.75, lng: -122.48, popK:   230 },
  { name: "Bremerton",      state: "WA", lat: 47.57, lng: -122.63, popK:   270 },
  // ── Ohio Valley / Upper South ─────────────────────────────────────
  { name: "Louisville",     state: "KY", lat: 38.25, lng:  -85.76, popK:  1290 },
  { name: "Lexington",      state: "KY", lat: 38.04, lng:  -84.50, popK:   520 },
  { name: "Charleston",     state: "WV", lat: 38.35, lng:  -81.63, popK:   250 },
  { name: "Hagerstown",     state: "MD", lat: 39.64, lng:  -77.72, popK:   300 },
  // ── Non-contiguous ────────────────────────────────────────────────
  { name: "Honolulu",       state: "HI", lat: 21.31, lng: -157.86, popK:  1000 },
  { name: "Anchorage",      state: "AK", lat: 61.22, lng: -149.90, popK:   400 },
];

const MILES_PER_DEG_LAT = 69.0;

/** Approx Haversine in degrees — fast and accurate enough at CONUS scale. */
function approxMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat1 - lat2) * MILES_PER_DEG_LAT;
  // Cheap longitude-to-miles correction at the mean latitude.
  const meanLatRad = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dLng = (lng1 - lng2) * MILES_PER_DEG_LAT * Math.cos(meanLatRad);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * "Capture radius" (miles) a metro can claim, growing with population.
 * A small town claims ~10 mi, a mid metro ~30, a major metro ~55, the very
 * largest ~75. Used by the weighted lookup so a bigger, more recognizable
 * city wins over a marginally-closer small town (Greeley over Cheyenne).
 */
function captureRadiusMiles(popK: number): number {
  const r = 10 + 20 * Math.log10(Math.max(popK, 10) / 20);
  return Math.min(75, Math.max(10, r));
}

export interface NearestMetroResult {
  /** "Dallas, TX" — the matched metro. */
  label: string;
  /** Distance to the matched metro in miles (rounded). */
  miles: number;
  /** The matched metro. */
  metro: Metro;
}

/**
 * Find the best metro label for a (lat, lng).
 *
 * `weighted: false` (default) — the geographically CLOSEST metro. Use this
 * for a point under the cursor, where the honest answer is "the nearest
 * town", period.
 *
 * `weighted: true` — the metro with the strongest claim, scored as
 * distance ÷ capture-radius(population). Use this to label a whole storm,
 * where a recognizable metro should beat a tiny town a few miles closer
 * (e.g. a northern-Colorado storm reads "Greeley, CO", not "Cheyenne, WY").
 *
 * Returns `null` only if the input is non-finite.
 */
export function nearestMetro(
  lat: number,
  lng: number,
  opts: { weighted?: boolean } = {},
): NearestMetroResult | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const weighted = opts.weighted ?? false;
  let best: Metro = METROS[0];
  let bestScore = Infinity;
  let bestMiles = Infinity;
  for (const m of METROS) {
    const miles = approxMiles(lat, lng, m.lat, m.lng);
    const score = weighted ? miles / captureRadiusMiles(m.popK) : miles;
    if (score < bestScore) {
      bestScore = score;
      bestMiles = miles;
      best = m;
    }
  }
  return {
    label: `${best.name}, ${best.state}`,
    miles: Math.round(bestMiles),
    metro: best,
  };
}
