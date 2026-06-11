/**
 * Server-only session cookie helpers.
 *
 * All cookies are first-party on the web origin (hailscout.net), httpOnly, and
 * (in prod) Secure — so the browser's JS never touches the refresh token. The
 * short-lived access token is handed to the browser on demand via
 * /api/auth/token for Bearer calls to the API.
 */
import { cookies } from "next/headers";

export const ACCESS_COOKIE = "hs_access";
export const REFRESH_COOKIE = "hs_refresh";
export const STATE_COOKIE = "hs_oauth_state";
export const VERIFIER_COOKIE = "hs_oauth_verifier";
// "Remember this device" 2FA trust token (LOGIN-STANDARD §4). Survives
// sign-out on purpose: its whole job is to skip the texted code at the NEXT
// sign-in (the password is still required). Server-side it's sha256-hashed,
// per-user, and revocable (forget-devices / MFA-disable / password reset).
export const DEVICE_TRUST_COOKIE = "hs_device_trust";

const isProd = process.env.NODE_ENV === "production";

const BASE = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
};

export async function setSessionCookies(
  access: string,
  accessMaxAgeSeconds: number,
  refresh: string,
  refreshMaxAgeDays = 30,
): Promise<void> {
  const c = await cookies();
  c.set(ACCESS_COOKIE, access, { ...BASE, maxAge: accessMaxAgeSeconds });
  c.set(REFRESH_COOKIE, refresh, { ...BASE, maxAge: refreshMaxAgeDays * 86400 });
}

export async function setAccessCookie(
  access: string,
  accessMaxAgeSeconds: number,
): Promise<void> {
  const c = await cookies();
  c.set(ACCESS_COOKIE, access, { ...BASE, maxAge: accessMaxAgeSeconds });
}

/**
 * Store a ROTATED refresh token (the API revokes the presented one on every
 * /v1/auth/refresh call now — losing this cookie write would strand the
 * session at its next refresh).
 */
export async function setRefreshCookie(
  refresh: string,
  refreshMaxAgeDays = 30,
): Promise<void> {
  const c = await cookies();
  c.set(REFRESH_COOKIE, refresh, { ...BASE, maxAge: refreshMaxAgeDays * 86400 });
}

export async function setDeviceTrustCookie(token: string): Promise<void> {
  const c = await cookies();
  c.set(DEVICE_TRUST_COOKIE, token, { ...BASE, maxAge: 90 * 86400 });
}

export async function clearSessionCookies(): Promise<void> {
  const c = await cookies();
  c.delete(ACCESS_COOKIE);
  c.delete(REFRESH_COOKIE);
}

export async function setOAuthTempCookies(
  state: string,
  verifier: string,
): Promise<void> {
  const c = await cookies();
  const opts = { ...BASE, maxAge: 600 }; // 10 minutes to complete the round-trip
  c.set(STATE_COOKIE, state, opts);
  c.set(VERIFIER_COOKIE, verifier, opts);
}

export async function clearOAuthTempCookies(): Promise<void> {
  const c = await cookies();
  c.delete(STATE_COOKIE);
  c.delete(VERIFIER_COOKIE);
}
