/**
 * /api/auth/:provider/callback — finish the OAuth flow.
 *
 * Google/Microsoft return via a same-site GET redirect (query string); Apple
 * returns via a CROSS-SITE form_post POST. Both paths validate state,
 * exchange the code for the provider id_token, then trade that with our API
 * (/v1/auth/exchange) for first-party session tokens, which we store as
 * httpOnly cookies.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getApple,
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

// Apple's callback is a POST, so its redirects must be 303 ("see other") to
// make the browser switch to GET — the default 307 would replay the POST
// against the redirect target. GETs keep the default.
function signInError(req: NextRequest, code: string, status: 303 | 307 = 307) {
  return NextResponse.redirect(
    new URL(`/sign-in?error=${encodeURIComponent(code)}`, req.url),
    status,
  );
}

/** Shared tail: trade the provider id_token for our own session tokens. */
async function finishWithApi(
  req: NextRequest,
  provider: string,
  idToken: string,
  redirectStatus: 303 | 307,
) {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, id_token: idToken }),
    });
  } catch {
    return signInError(req, "exchange_unreachable", redirectStatus);
  }
  if (!res.ok) {
    return signInError(
      req,
      res.status === 403 ? "no_account" : "exchange_failed",
      redirectStatus,
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token: string;
  };
  await setSessionCookies(data.access_token, data.expires_in, data.refresh_token);

  return NextResponse.redirect(new URL("/app/map", req.url), redirectStatus);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  // Apple never returns via GET (response_mode=form_post) — see POST below.
  if (!isProvider(provider) || provider === "apple") {
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

  return finishWithApi(req, provider, idToken, 307);
}

/**
 * Apple returns via form_post: a cross-site POST carrying code/state. The
 * very FIRST consent also includes a one-time `user` JSON blob (display
 * name) — deliberately unused: HailScout is invite-only, so the account (and
 * its name) already exists. Returning users may get an id_token with no
 * email; the API resolves them by the linked (provider, sub) subject.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (provider !== "apple") {
    return new NextResponse("Unknown provider", { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return signInError(req, "oauth_failed", 303);
  }

  const err = form.get("error");
  if (typeof err === "string" && err) {
    return signInError(req, err, 303);
  }

  const code = form.get("code");
  const state = form.get("state");
  const c = await cookies();
  const storedState = c.get(STATE_COOKIE)?.value;
  if (
    typeof code !== "string" ||
    typeof state !== "string" ||
    !storedState ||
    state !== storedState
  ) {
    return signInError(req, "invalid_state", 303);
  }

  let idToken: string;
  try {
    idToken = (await getApple().validateAuthorizationCode(code)).idToken();
  } catch {
    return signInError(req, "oauth_failed", 303);
  }
  await clearOAuthTempCookies();

  return finishWithApi(req, provider, idToken, 303);
}
