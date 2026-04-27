import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useState } from "react";

/**
 * useAuthToken Hook
 *
 * Wraps Clerk's useAuth hook to:
 * - Fetch the current JWT token
 * - Handle token refresh
 * - Provide convenient error handling
 */

export function useAuthToken() {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const token = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken({ template: "hailscout" });
      return token;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error("Failed to get auth token:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  return {
    token,
    isLoading,
    error,
  };
}
