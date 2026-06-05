"use client";

import { useCallback, useState } from "react";

interface GeoState {
  coords: { lat: number; lng: number } | null;
  loading: boolean;
  error: string | null;
}

/**
 * Thin wrapper over the Geolocation API for the field "what hit me here" flow.
 * `locate()` requests the device's current position (prompts for permission).
 */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ coords: null, loading: false, error: null });

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState((s) => ({ ...s, error: "Location isn't available on this device." }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          loading: false,
          error: null,
        });
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Enable it to use your current spot."
            : err.code === err.TIMEOUT
              ? "Locating timed out. Try again with a clear sky view."
              : "Couldn't get your location.";
        setState({ coords: null, loading: false, error: msg });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  return { ...state, locate };
}
