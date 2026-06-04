/**
 * GET /api/auth/:provider — start the OAuth flow.
 *
 * Generates state + PKCE verifier, stashes them in short-lived httpOnly
 * cookies, and redirects to Google/Microsoft.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateState, generateCodeVerifier } from "arctic";
import {
  getGoogle,
  getMicrosoft,
  isProvider,
  OAUTH_SCOPES,
} from "@/lib/auth/providers";
import { setOAuthTempCookies } from "@/lib/auth/cookies";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isProvider(provider)) {
    return new NextResponse("Unknown provider", { status: 404 });
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  let url: URL;
  try {
    url =
      provider === "google"
        ? getGoogle().createAuthorizationURL(state, codeVerifier, OAUTH_SCOPES)
        : getMicrosoft().createAuthorizationURL(state, codeVerifier, OAUTH_SCOPES);
  } catch {
    return new NextResponse("OAuth provider not configured", { status: 500 });
  }

  await setOAuthTempCookies(state, codeVerifier);
  return NextResponse.redirect(url);
}
