import type { Map as MapLibreMap, LngLatBoundsLike } from "maplibre-gl";

interface SnapshotOptions {
  /** Bounding box of the storm: [[minLng, minLat], [maxLng, maxLat]] */
  bounds: LngLatBoundsLike;
  /** Padding around the bounds in pixels. */
  padding?: number;
  /** Animation duration (ms). 0 = jump (instant). */
  duration?: number;
  /** Maximum time to wait for `idle` before snapping anyway (ms). */
  timeoutMs?: number;
}

/**
 * Fly the map to storm bounds, wait for tiles + animation to settle,
 * then capture the WebGL canvas as a PNG dataURL.
 *
 * Falls back to a best-effort snapshot if `idle` doesn't fire within
 * `timeoutMs` (rare — usually means the user lost connectivity).
 */
export async function captureMapSnapshot(
  map: MapLibreMap,
  { bounds, padding = 60, duration = 600, timeoutMs = 4000 }: SnapshotOptions,
): Promise<string> {
  // Trigger the fly-to
  map.fitBounds(bounds, { padding, duration });

  // Wait for the map to settle. `idle` fires when (a) the camera animation
  // has ended AND (b) all visible tiles have been loaded.
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      map.off("idle", finish);
      resolve();
    };
    map.once("idle", finish);
    setTimeout(finish, timeoutMs);
  });

  // Give the GPU one extra frame to flush
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  return map.getCanvas().toDataURL("image/png");
}
