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
        ? "No Hail GPS account exists for that email. Ask your administrator to add you."
        : detail || "Sign-in failed. Please try again.",
    );
  }
  return res.json() as Promise<ExchangeResult>;
}

/**
 * Thrown when the password was correct but the account has SMS 2FA enrolled:
 * the API has just texted a code and wants it on the next attempt. Carries the
 * masked phone so the form can say where the code went.
 */
export class MfaRequiredError extends Error {
  readonly phone: string | null;
  constructor(detail: string, phone: string | null) {
    super(detail);
    this.name = "MfaRequiredError";
    this.phone = phone;
  }
}

/**
 * Email + password sign-in. Mints the same session as the social `exchange`
 * path, so everything downstream is identical.
 *
 * Required by both app stores: a reviewer cannot sign in through Google or
 * Microsoft, so without this there is no way to hand them a demo account.
 */
export async function passwordLogin(
  email: string,
  password: string,
  mfaCode?: string,
): Promise<ExchangeResult> {
  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      ...(mfaCode ? { mfa_code: mfaCode } : {}),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (
    res.status === 401 &&
    (body.error === "mfa_required" || body.error === "invalid_mfa_code")
  ) {
    throw new MfaRequiredError(
      (body.detail as string) || "Enter the 6-digit code we texted you.",
      (body.phone as string | null) ?? null,
    );
  }
  if (!res.ok) {
    throw new Error(
      (body.detail as string) ||
        (res.status === 429
          ? "Too many sign-in attempts. Wait a few minutes and try again."
          : "Incorrect email or password."),
    );
  }
  // Privileged accounts past their 2FA grace window get an enrollment-only
  // token with NO refresh token — signing in here would strand them, so send
  // them to the web to enroll rather than half-authenticating.
  if (body.mfa_enrollment_required) {
    throw new Error(
      "This account needs two-factor authentication set up on the website before it can sign in here.",
    );
  }
  return body as unknown as ExchangeResult;
}

export interface RefreshResult {
  access_token: string;
  expires_in: number;
  /**
   * Successor refresh token (LOGIN-STANDARD session policy): we opt into
   * rotation, so the token we just presented is left with only ~60s of
   * life — callers MUST persist this replacement or the next refresh will
   * 401. Optional for compatibility with an older API build that didn't
   * rotate.
   */
  refresh_token?: string | null;
}

export async function refreshAccess(refresh: string): Promise<RefreshResult> {
  const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // rotate: this build persists the successor (saveRefresh in callers),
    // so opt in. Deployed builds that omit the flag keep their token.
    body: JSON.stringify({ refresh_token: refresh, rotate: true }),
  });
  if (!res.ok) throw new Error("session expired");
  return res.json() as Promise<RefreshResult>;
}

export async function saveRefresh(refresh: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
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

/** Delete the signed-in user's own account (App Store 5.1.1(v) / Play). The
 * server immediately disables the account + revokes sessions; the data purge
 * completes within 30 days. The caller signs out on success. */
export async function deleteAccount(accessToken: string): Promise<void> {
  const res = await fetch(`${API_BASE}/v1/account/delete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error("Account deletion failed. Please try again.");
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
