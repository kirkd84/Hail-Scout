"use client";

/**
 * Hook to fetch the current user's profile from /v1/me, including the
 * `is_super_admin` flag. Cached per session via SWR-style state to avoid
 * pinging the API on every render.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.hailscout.com";

export type MeUser = {
  id: string;
  email: string;
  role: string;
  is_super_admin: boolean;
  created_at: string;
};

export type MeOrganization = {
  id: string;
  name: string;
  plan_tier: string;
  created_at: string;
};

export type Me = {
  user: MeUser;
  organization: MeOrganization;
  seats: Array<{ id: number; user_id: string; assigned_at: string }>;
};

let cached: Me | null = null;
let inflight: Promise<Me | null> | null = null;

export function useMe(): {
  me: Me | null;
  loading: boolean;
  error: string | null;
} {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [me, setMe] = useState<Me | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setLoading(false);
      return;
    }
    if (cached) {
      setMe(cached);
      setLoading(false);
      return;
    }
    if (!inflight) {
      inflight = (async () => {
        const token = await getToken();
        const res = await fetch(`${API}/v1/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          inflight = null;
          throw new Error(`Failed: ${res.status}`);
        }
        const data = (await res.json()) as Me;
        cached = data;
        inflight = null;
        return data;
      })();
    }
    inflight
      .then((data) => {
        setMe(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, [getToken, isLoaded, isSignedIn]);

  return { me, loading, error };
}
