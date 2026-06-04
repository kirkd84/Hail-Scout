/**
 * POST /api/auth/logout — revoke the server-side session and clear cookies.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { REFRESH_COOKIE, clearSessionCookies } from "@/lib/auth/cookies";
import { API_BASE } from "@/lib/auth/providers";

export async function POST() {
  const c = await cookies();
  const refresh = c.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    try {
      await fetch(`${API_BASE}/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
    } catch {
      // Best-effort revoke; we still clear the cookies below.
    }
  }
  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
