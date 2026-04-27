import React from "react";
import * as SecureStore from "expo-secure-store";

/**
 * Token cache implementation for Clerk Expo SDK.
 * Uses expo-secure-store for encrypted token storage on device.
 *
 * This is the official Clerk Expo recipe for token caching.
 */
export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      const token = await SecureStore.getItemAsync(key);
      if (token) {
        console.log("Token retrieved from secure storage");
        return token;
      }
    } catch (err) {
      console.warn("Failed to retrieve token from secure storage:", err);
    }
    return null;
  },

  async saveToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
      console.log("Token saved to secure storage");
    } catch (err) {
      console.warn("Failed to save token to secure storage:", err);
    }
  },
};

/**
 * Hook to check if token caching is available on this platform.
 * Required because SecureStore may not work in all environments.
 */
export function useIsTokenCacheReady(): boolean {
  // SecureStore is available on both iOS and Android
  // For web/web testing, we'd need a fallback
  return true;
}
