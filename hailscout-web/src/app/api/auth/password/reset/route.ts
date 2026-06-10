/** BFF relay completing a password reset (token + new password). */
import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/auth/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.token || !body?.newPassword) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1/auth/password/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: body.token, new_password: body.newPassword }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "exchange_unreachable" }, { status: 502 });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json(
      { error: "reset_failed", detail: data?.detail ?? "Reset failed." },
      { status: res.status },
    );
  }
  return NextResponse.json({ ok: true });
}
