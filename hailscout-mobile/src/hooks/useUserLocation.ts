import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

export type LocationPermissionStatus =
  | "undetermined"
  | "granted"
  | "foreground"
  | "denied"
  | "background";

export interface UserLocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * useUserLocation Hook
 *
 * Manages user location permissions and tracking.
 *
 * Usage:
 *   const { userLocation, permissionStatus, requestLocationPermission } = useUserLocation();
 *
 * Features:
 * - Requests "whenInUse" location permission (foreground only)
 * - Watches for location updates
 * - Handles permission denials gracefully
 */
export function useUserLocation() {
  const [userLocation, setUserLocation] = useState<UserLocationCoords | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<LocationPermissionStatus>("undetermined");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const requestLocationPermission = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === "granted") {
        setPermissionStatus("granted");

        // Get initial location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || 0,
        });

        // Start watching for updates. Keep the handle so the unmount
        // effect can stop it — this is an async action, NOT a hook cleanup,
        // so returning a function here did nothing and broke the
        // Promise<void> signature.
        watchRef.current?.remove();
        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (location) => {
            setUserLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy || 0,
            });
          },
        );
      } else {
        setPermissionStatus("denied");
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error("Location permission error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check initial permission status on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        setPermissionStatus("granted");
        // Optionally get initial location
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || 0,
          });
        } catch (err) {
          console.warn("Could not get initial location:", err);
        }
      } else {
        setPermissionStatus("undetermined");
      }
    })();
  }, []);

  // Stop the location watch on unmount.
  useEffect(() => () => { watchRef.current?.remove(); }, []);

  return {
    userLocation,
    permissionStatus,
    isLoading,
    error,
    requestLocationPermission,
  };
}
