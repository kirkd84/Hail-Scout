/**
 * GET /api/auth/token — hand the browser a fresh access token for Bearer calls.
 *
 * Reads the httpOnly access cookie; if it's missing or about to expire, uses
 * the httpOnly refresh cookie to mint a new one via the API. The refresh token
 * itself never leaves the server. This is the BFF equivalent of Clerk's
 * getToken().
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  setAccessCookie,
  setRefreshCookie,
  clearSessionCookies,
} from "@/lib/auth/cookies";
import { API_BASE } from "@/lib/auth/providers";

function expiringSoon(jwt: string): boolean {
  try {
    const payload = jwt.split(".")[1];
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const exp = Number(data.exp);
    return !exp || exp * 1000 - Date.now() < 60_000; // <60s of life left
  } catch {
    return true;
  }
}

export async function GET() {
  const c = await cookies();
  const access = c.get(ACCESS_COOKIE)?.value;
  if (access && !expiringSoon(access)) {
    return NextResponse.json({ token: access });
  }

  const refresh = c.get(REFRESH_COOKIE)?.value;
  if (!refresh) {
    return NextResponse.json({ token: null }, { status: 401 });
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // rotate: we store the successor below, so opt in to rotation. The
      // API keeps the presented token alive on a short grace fuse, which
      // lets a concurrent second tab (same cookie) refresh too instead of
      // 401ing into clearSessionCookies.
      body: JSON.stringify({ refresh_token: refresh, rotate: true }),
    });
  } catch {
    return NextResponse.json({ token: null }, { status: 503 });
  }
  if (!res.ok) {
    await clearSessionCookies();
    return NextResponse.json({ token: null }, { status: 401 });
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    // Successor token (LOGIN-STANDARD §5): we asked for rotation, so the
    // token we just sent expires in ~60s — persist its replacement.
    // Optional so this route also tolerates an older API build.
    refresh_token?: string | null;
  };
  await setAccessCookie(data.access_token, data.expires_in);
  if (data.refresh_token) {
    await setRefreshCookie(data.refresh_token);
  }
  return NextResponse.json({ token: data.access_token });
}
