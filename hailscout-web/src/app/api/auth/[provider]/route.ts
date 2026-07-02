/**
 * GET /api/auth/:provider — start the OAuth flow.
 *
 * Generates state (+ a PKCE verifier for Google/Microsoft), stashes them in
 * short-lived httpOnly cookies, and redirects to the provider. Apple uses no
 * PKCE, and its callback arrives as a cross-site form_post POST.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateState, generateCodeVerifier } from "arctic";
import {
  getApple,
  getGoogle,
  getMicrosoft,
  isProvider,
  OAUTH_SCOPES,
} from "@/lib/auth/providers";
import {
  setAppleOAuthTempCookies,
  setOAuthTempCookies,
} from "@/lib/auth/cookies";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isProvider(provider)) {
    return new NextResponse("Unknown provider", { status: 404 });
  }

  const state = generateState();

  // Apple (dark until the APPLE_* envs exist — getApple() throws): no PKCE,
  // Apple-specific scopes, and response_mode=form_post (required once name/
  // email scopes are requested) which makes the callback a cross-site POST —
  // hence the SameSite=None state cookie.
  if (provider === "apple") {
    let url: URL;
    try {
      url = getApple().createAuthorizationURL(state, ["name", "email"]);
    } catch {
      return new NextResponse("OAuth provider not configured", { status: 500 });
    }
    url.searchParams.set("response_mode", "form_post");
    await setAppleOAuthTempCookies(state);
    return NextResponse.redirect(url);
  }

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
