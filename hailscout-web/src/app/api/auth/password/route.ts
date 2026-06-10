/**
 * BFF email+password sign-in. The browser posts credentials here; we call
 * the API and set the same httpOnly session cookies as the OAuth callback,
 * so tokens never reach browser JS regardless of sign-in method.
 */
import { NextRequest, NextResponse } from "next/server";
import { setSessionCookies } from "@/lib/auth/cookies";
import { API_BASE } from "@/lib/auth/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "exchange_unreachable" }, { status: 502 });
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    // Pass the API's status through (401 invalid creds, 429 lockout) with
    // its human-readable detail so the form can show it.
    return NextResponse.json(
      { error: "invalid_credentials", detail: data?.detail ?? "Sign-in failed." },
      { status: res.status === 429 ? 429 : 401 },
    );
  }

  await setSessionCookies(data.access_token, data.expires_in, data.refresh_token);
  return NextResponse.json({ ok: true });
}
