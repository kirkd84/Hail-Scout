/**
 * GET /api/auth/:provider/callback — finish the OAuth flow.
 *
 * Validates state + PKCE, exchanges the code for the provider id_token, then
 * trades that with our API (/v1/auth/exchange) for first-party session tokens,
 * which we store as httpOnly cookies.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getGoogle,
  getMicrosoft,
  isProvider,
  API_BASE,
} from "@/lib/auth/providers";
import {
  STATE_COOKIE,
  VERIFIER_COOKIE,
  setSessionCookies,
  clearOAuthTempCookies,
} from "@/lib/auth/cookies";

function signInError(req: NextRequest, code: string) {
  return NextResponse.redirect(
    new URL(`/sign-in?error=${encodeURIComponent(code)}`, req.url),
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isProvider(provider)) {
    return new NextResponse("Unknown provider", { status: 404 });
  }

  const url = new URL(req.url);
  if (url.searchParams.get("error")) {
    return signInError(req, url.searchParams.get("error") as string);
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const c = await cookies();
  const storedState = c.get(STATE_COOKIE)?.value;
  const verifier = c.get(VERIFIER_COOKIE)?.value;
  if (!code || !state || !storedState || !verifier || state !== storedState) {
    return signInError(req, "invalid_state");
  }

  let idToken: string;
  try {
    const tokens =
      provider === "google"
        ? await getGoogle().validateAuthorizationCode(code, verifier)
        : await getMicrosoft().validateAuthorizationCode(code, verifier);
    idToken = tokens.idToken();
  } catch {
    return signInError(req, "oauth_failed");
  }
  await clearOAuthTempCookies();

  // Trade the provider id_token for our own session tokens.
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, id_token: idToken }),
    });
  } catch {
    return signInError(req, "exchange_unreachable");
  }
  if (!res.ok) {
    return signInError(req, res.status === 403 ? "no_account" : "exchange_failed");
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token: string;
  };
  await setSessionCookies(data.access_token, data.expires_in, data.refresh_token);

  return NextResponse.redirect(new URL("/app/map", req.url));
}
