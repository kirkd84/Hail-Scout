import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as session from "./session";
import {
  registerForPushNotifications,
  unregisterPushNotifications,
} from "@/lib/push";

interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: session.SessionUser | null;
  organization: session.SessionOrg | null;
  /** Fresh access token for API calls (refreshes transparently). */
  getToken: () => Promise<string | null>;
  /** Finish sign-in with a verified provider id_token. */
  completeSignIn: (provider: "google" | "microsoft", idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState<session.SessionUser | null>(null);
  const [organization, setOrganization] = useState<session.SessionOrg | null>(null);
  const cache = useRef<{ token: string | null; exp: number }>({ token: null, exp: 0 });
  // Single-flight: with refresh-token ROTATION, two concurrent refresh calls
  // would race — the loser presents an already-revoked token and gets
  // signed out. Funnel all callers through one in-flight promise.
  const inflight = useRef<Promise<string | null> | null>(null);

  // On launch, try to mint a fresh access token from the stored refresh token.
  useEffect(() => {
    (async () => {
      const refresh = await session.getRefresh();
      if (!refresh) {
        setIsLoaded(true);
        return;
      }
      try {
        const { access_token, refresh_token } = await session.refreshAccess(refresh);
        await session.saveAccess(access_token);
        // The API rotates refresh tokens: the one we just used is revoked,
        // so persist its successor or the next refresh would sign us out.
        if (refresh_token) await session.saveRefresh(refresh_token);
        cache.current = { token: access_token, exp: session.decodeExpMs(access_token) };
        setIsSignedIn(true);
        void registerForPushNotifications(async () => access_token);
        try {
          const me = await session.fetchMe(access_token);
          setUser(me.user);
          setOrganization(me.organization);
        } catch {
          /* profile is best-effort; the tokens are still valid */
        }
      } catch {
        await session.clearTokens();
        setIsSignedIn(false);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (cache.current.token && cache.current.exp - Date.now() > 60_000) {
      return cache.current.token;
    }
    if (inflight.current) return inflight.current;
    const p = (async (): Promise<string | null> => {
      try {
        const refresh = await session.getRefresh();
        if (!refresh) return null;
        try {
          const { access_token, refresh_token } = await session.refreshAccess(refresh);
          await session.saveAccess(access_token);
          if (refresh_token) await session.saveRefresh(refresh_token);
          cache.current = { token: access_token, exp: session.decodeExpMs(access_token) };
          return access_token;
        } catch {
          await session.clearTokens();
          cache.current = { token: null, exp: 0 };
          setIsSignedIn(false);
          return null;
        }
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = p;
    return p;
  }, []);

  const completeSignIn = useCallback(
    async (provider: "google" | "microsoft", idToken: string) => {
      const r = await session.exchange(provider, idToken);
      await session.saveTokens(r.access_token, r.refresh_token);
      cache.current = { token: r.access_token, exp: session.decodeExpMs(r.access_token) };
      setUser(r.user);
      setOrganization(r.organization);
      setIsSignedIn(true);
      void registerForPushNotifications(async () => r.access_token);
    },
    [],
  );

  const signOut = useCallback(async () => {
    await unregisterPushNotifications(getToken);
    const refresh = await session.getRefresh();
    if (refresh) await session.logout(refresh);
    await session.clearTokens();
    cache.current = { token: null, exp: 0 };
    setUser(null);
    setOrganization(null);
    setIsSignedIn(false);
  }, []);

  return (
    <Ctx.Provider
      value={{ isLoaded, isSignedIn, user, organization, getToken, completeSignIn, signOut }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
