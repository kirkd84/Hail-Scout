/**
 * Mobile fixture data — lightweight subset of the web fixtures.
 * Kept identical to the web's centroid/peak/timestamps so the same demo
 * storms read across both platforms.
 */

export interface MobileStorm {
  id: string;
  city: string;
  centroid_lat: number;
  centroid_lng: number;
  peak_size_in: number;
  start_time: string;
  end_time: string;
  is_live: boolean;
}

const NOW = Date.now();
const ago = (m: number) => new Date(NOW - m * 60_000).toISOString();
const day = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString();

export const STORMS: MobileStorm[] = [
  // Live
  { id: "fx-storm-live-wichita-falls", city: "Wichita Falls, TX", centroid_lat: 33.91, centroid_lng:  -98.49, peak_size_in: 2.25, start_time: ago(14),  end_time: ago(-30), is_live: true  },
  { id: "fx-storm-live-dodge-city",    city: "Dodge City, KS",    centroid_lat: 37.75, centroid_lng: -100.02, peak_size_in: 1.75, start_time: ago(38),  end_time: ago(-12), is_live: true  },
  { id: "fx-storm-live-tulsa",         city: "Tulsa, OK",         centroid_lat: 36.15, centroid_lng:  -95.99, peak_size_in: 2.5,  start_time: ago(72),  end_time: ago(8),   is_live: true  },
  { id: "fx-storm-live-greenville",    city: "Greenville, TX",    centroid_lat: 33.14, centroid_lng:  -96.11, peak_size_in: 1.5,  start_time: ago(128), end_time: ago(72),  is_live: false },
  // Archive
  { id: "fx-storm-amarillo-04-26", city: "Amarillo, TX",          centroid_lat: 35.22, centroid_lng: -101.83, peak_size_in: 3.5,  start_time: day(3),  end_time: day(3),  is_live: false },
  { id: "fx-storm-okc-04-14",      city: "Oklahoma City, OK",     centroid_lat: 35.47, centroid_lng:  -97.50, peak_size_in: 3.0,  start_time: day(4),  end_time: day(4),  is_live: false },
  { id: "fx-storm-dfw-04-12",      city: "Dallas–Fort Worth, TX", centroid_lat: 32.81, centroid_lng:  -96.97, peak_size_in: 2.75, start_time: day(5),  end_time: day(5),  is_live: false },
  { id: "fx-storm-kc-04-20",       city: "Kansas City, MO",       centroid_lat: 39.10, centroid_lng:  -94.58, peak_size_in: 2.5,  start_time: day(6),  end_time: day(6),  is_live: false },
  { id: "fx-storm-denver-04-18",   city: "Denver, CO",            centroid_lat: 39.74, centroid_lng: -104.99, peak_size_in: 2.25, start_time: day(7),  end_time: day(7),  is_live: false },
  { id: "fx-storm-lubbock-04-21",  city: "Lubbock, TX",           centroid_lat: 33.58, centroid_lng: -101.86, peak_size_in: 2.0,  start_time: day(8),  end_time: day(8),  is_live: false },
  { id: "fx-storm-ind-04-25",      city: "Indianapolis, IN",      centroid_lat: 39.77, centroid_lng:  -86.16, peak_size_in: 1.75, start_time: day(9),  end_time: day(9),  is_live: false },
  { id: "fx-storm-wichita-04-15",  city: "Wichita, KS",           centroid_lat: 37.69, centroid_lng:  -97.34, peak_size_in: 1.75, start_time: day(10), end_time: day(10), is_live: false },
  { id: "fx-storm-omaha-04-19",    city: "Omaha, NE",             centroid_lat: 41.26, centroid_lng:  -95.93, peak_size_in: 1.5,  start_time: day(11), end_time: day(11), is_live: false },
  { id: "fx-storm-stl-04-22",      city: "St. Louis, MO",         centroid_lat: 38.63, centroid_lng:  -90.20, peak_size_in: 1.25, start_time: day(12), end_time: day(12), is_live: false },
];
