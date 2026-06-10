/** BFF relay for self-service password reset requests (always answers ok). */
import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/auth/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.email) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  try {
    await fetch(`${API_BASE}/v1/auth/password/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email }),
      cache: "no-store",
    });
  } catch {
    /* deliberate: same response either way */
  }
  return NextResponse.json({ ok: true });
}
