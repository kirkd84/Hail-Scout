/**
 * HailScout mobile API client.
 *
 * Reads the API base URL from the env (compiled at build time via Expo).
 * Use with the `useApi()` hook for token injection.
 */

const DEFAULT_API_BASE = "https://hail-scout-production.up.railway.app";

export const API_BASE: string =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) || DEFAULT_API_BASE;

export interface ApiOpts extends RequestInit {
  token?: string | null;
}

export async function apiRequest<T>(path: string, opts: ApiOpts = {}): Promise<T> {
  const { token, headers, ...rest } = opts;
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...((headers as Record<string, string> | undefined) ?? {}),
  };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...rest, headers: finalHeaders });
  let body: unknown = null;
  try { body = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const err = new Error(`API ${res.status} ${res.statusText}`) as Error & { status?: number; detail?: unknown };
    err.status = res.status;
    err.detail = body;
    throw err;
  }
  return body as T;
}
