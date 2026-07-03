/**
 * Routing client — calls our own `/v1/route` proxy (key stays server-side), so
 * the app never holds a routing provider key and the provider can be swapped
 * server-side. Returns a normalized driving route + turn-by-turn steps.
 */

import { apiRequest } from "@/lib/api";

export interface RouteStep {
  instruction: string;
  distance_m: number;
  duration_s: number;
  type: number;
  name: string;
  location: [number, number]; // lng, lat — the maneuver point
}

export interface Route {
  geometry: [number, number][]; // lng, lat polyline
  distance_m: number;
  duration_s: number;
  steps: RouteStep[];
}

export async function fetchRoute(
  start: { lng: number; lat: number },
  end: { lng: number; lat: number },
  token: string | null,
): Promise<Route> {
  const qs =
    `start=${start.lng.toFixed(6)},${start.lat.toFixed(6)}` +
    `&end=${end.lng.toFixed(6)},${end.lat.toFixed(6)}`;
  return apiRequest<Route>(`/v1/route?${qs}`, { token });
}
