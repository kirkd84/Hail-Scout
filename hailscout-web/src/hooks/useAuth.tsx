"use client";

/**
 * First-party auth client — a drop-in replacement for Clerk's `useAuth`.
 *
 * Backed by the BFF routes under /api/auth. The browser holds only a
 * short-lived access token in memory (fetched from /api/auth/token); the
 * refresh token stays in an httpOnly cookie the JS can't read.
 *
 * Exposes the same surface existing call sites used:
 *   const { getToken, isLoaded, isSignedIn } = useAuth();
 *   const { signOut } = useClerk();   // compat shim
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  signOut: (cb?: () => void) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

function decodeExpMs(token: string): number {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(json);
    return (Number(data.exp) || 0) * 1000;
  } catch {
    return 0;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const cache = useRef<{ token: string | null; exp: number }>({
    token: null,
    exp: 0,
  });
  // Single-flight: on first paint a dozen SWR hooks call getToken()
  // simultaneously — without this they each hit /api/auth/token (and the
  // API's /v1/auth/refresh behind it) in parallel.
  const inflight = useRef<Promise<string | null> | null>(null);

  const fetchToken = useCallback(async (): Promise<string | null> => {
    if (inflight.current) return inflight.current;
    const p = (async (): Promise<string | null> => {
      try {
        const res = await fetch("/api/auth/token", { cache: "no-store" });
        if (!res.ok) {
          cache.current = { token: null, exp: 0 };
          return null;
        }
        const data = (await res.json()) as { token: string | null };
        const token = data.token ?? null;
        cache.current = { token, exp: token ? decodeExpMs(token) : 0 };
        return token;
      } catch {
        return null;
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = p;
    return p;
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    const { token, exp } = cache.current;
    if (token && exp - Date.now() > 60_000) return token;
    return fetchToken();
  }, [fetchToken]);

  const refresh = useCallback(async () => {
    const token = await fetchToken();
    setIsSignedIn(Boolean(token));
    setIsLoaded(true);
  }, [fetchToken]);

  const signOut = useCallback(async (cb?: () => void) => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    cache.current = { token: null, exp: 0 };
    setIsSignedIn(false);
    if (cb) cb();
    else window.location.href = "/";
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AuthCtx.Provider
      value={{ isLoaded, isSignedIn, getToken, signOut, refresh }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) {
    return {
      isLoaded: true,
      isSignedIn: false,
      getToken: async () => null,
      signOut: async () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}

/** Clerk-compat shim: `const { signOut } = useClerk();` */
export function useClerk(): { signOut: (cb?: () => void) => Promise<void> } {
  const { signOut } = useAuth();
  return { signOut };
}
