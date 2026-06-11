/**
 * BFF email+password sign-in. The browser posts credentials here; we call
 * the API and set the same httpOnly session cookies as the OAuth callback,
 * so tokens never reach browser JS regardless of sign-in method.
 *
 * SMS 2FA (LOGIN-STANDARD §4): the API answers 401 `mfa_required` (and
 * texts a code) once the password is correct on an enrolled account — we
 * pass that through so the form can reveal the code field. The httpOnly
 * device-trust cookie is attached on the way in (skips the code on a
 * remembered device) and stored on the way out when the user ticked
 * "remember this device".
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  DEVICE_TRUST_COOKIE,
  clearSessionCookies,
  setAccessCookie,
  setDeviceTrustCookie,
  setSessionCookies,
} from "@/lib/auth/cookies";
import { API_BASE } from "@/lib/auth/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: {
    email?: string;
    password?: string;
    mfa_code?: string;
    remember_device?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const c = await cookies();
  const deviceTrust = c.get(DEVICE_TRUST_COOKIE)?.value;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
        ...(body.mfa_code ? { mfa_code: body.mfa_code } : {}),
        ...(body.remember_device ? { remember_device: true } : {}),
        ...(deviceTrust ? { device_trust_token: deviceTrust } : {}),
      }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "exchange_unreachable" }, { status: 502 });
  }

  const data = await res.json().catch(() => null);

  // Correct password on an MFA-enrolled account: the API just texted a code
  // (or rejected a wrong one). Surface the structured error so the sign-in
  // form can show the code step instead of a generic failure.
  if (
    res.status === 401 &&
    (data?.error === "mfa_required" || data?.error === "invalid_mfa_code")
  ) {
    return NextResponse.json(
      {
        error: data.error,
        detail: data.detail ?? "A 6-digit code is required.",
        phone: data.phone ?? null,
      },
      { status: 401 },
    );
  }

  // Owner/admin whose MFA-enrollment grace window lapsed: the API returns an
  // enrollment-scoped token (usable ONLY on the MFA enrollment endpoints).
  // Drop any previous session's cookies first (this person just proved a
  // password — a stale refresh cookie from an earlier sign-in must not
  // outlive the enroll flow), then store the enroll token as the access
  // cookie with no refresh cookie, and send them to the enroll page.
  if (res.ok && data?.mfa_enrollment_required && data?.enrollment_token) {
    await clearSessionCookies();
    await setAccessCookie(data.enrollment_token, data.expires_in ?? 3600);
    return NextResponse.json({ mfa_enrollment_required: true });
  }

  if (!res.ok || !data?.access_token) {
    // Pass the API's status through (401 invalid creds, 429 lockout) with
    // its human-readable detail so the form can show it.
    return NextResponse.json(
      { error: "invalid_credentials", detail: data?.detail ?? "Sign-in failed." },
      { status: res.status === 429 ? 429 : 401 },
    );
  }

  await setSessionCookies(data.access_token, data.expires_in, data.refresh_token);
  // Returned exactly once when the user ticked "remember this device" and
  // the code verified. httpOnly — browser JS never sees the raw token.
  if (data.device_trust_token) {
    await setDeviceTrustCookie(data.device_trust_token);
  }
  return NextResponse.json({
    ok: true,
    // Present during an un-enrolled owner/admin's grace window — the form
    // routes to Settings → Security so they enroll before the deadline.
    mfa_enrollment: data.mfa_enrollment ?? null,
  });
}
