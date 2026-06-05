/**
 * First-party session store for mobile. Mirrors the web BFF: the device runs
 * native Google/Microsoft sign-in to get a provider id_token, trades it at
 * /v1/auth/exchange for our own access + refresh tokens, and keeps them in the
 * OS keychain (expo-secure-store). The refresh token never leaves the device
 * except to /v1/auth/refresh.
 */
import * as SecureStore from "expo-secure-store";
import { API_BASE } from "@/lib/api";

const ACCESS_KEY = "hs_access";
const REFRESH_KEY = "hs_refresh";

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  is_super_admin: boolean;
}
export interface SessionOrg {
  id: string;
  name: string;
  plan_tier: string;
}
export interface ExchangeResult {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  user: SessionUser;
  organization: SessionOrg;
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}
export async function saveAccess(access: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_KEY, access);
}
export async function getRefresh(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}
export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

/** Read the `exp` (ms) out of a JWT without verifying it — for refresh timing. */
export function decodeExpMs(jwt: string): number {
  try {
    const payload = jwt.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return (JSON.parse(json).exp ?? 0) * 1000;
  } catch {
    return 0;
  }
}

export async function exchange(provider: string, idToken: string): Promise<ExchangeResult> {
  const res = await fetch(`${API_BASE}/v1/auth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, id_token: idToken }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    const detail = (body as { detail?: string })?.detail;
    throw new Error(
      res.status === 403
        ? "No HailScout account exists for that email. Ask your administrator to add you."
        : detail || "Sign-in failed. Please try again.",
    );
  }
  return res.json() as Promise<ExchangeResult>;
}

export async function refreshAccess(refresh: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) throw new Error("session expired");
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function logout(refresh: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/v1/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
  } catch {
    /* best-effort */
  }
}

export interface MeResult {
  user: SessionUser;
  organization: SessionOrg;
}

/** Load the signed-in profile (used on relaunch to repopulate user/org). */
export async function fetchMe(accessToken: string): Promise<MeResult> {
  const res = await fetch(`${API_BASE}/v1/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to load profile");
  const d = (await res.json()) as MeResult;
  return { user: d.user, organization: d.organization };
}
