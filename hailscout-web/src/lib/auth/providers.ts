/**
 * Server-only OAuth provider config (Arctic).
 *
 * Client *secrets* live here in the web tier — Arctic runs the code-exchange
 * server-side. The API never sees them; it only verifies the resulting
 * provider id_token. Redirect URIs must EXACTLY match what's registered in the
 * Google Cloud / Azure app registrations.
 */
import { Google, MicrosoftEntraId } from "arctic";

export const OAUTH_SCOPES = ["openid", "profile", "email"];

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://hail-scout-production.up.railway.app";

/** Public base URL of the web app (for OAuth redirect URIs). */
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export type ProviderName = "google" | "microsoft";

export function isProvider(p: string): p is ProviderName {
  return p === "google" || p === "microsoft";
}

export function redirectURI(provider: ProviderName): string {
  return `${APP_URL}/api/auth/${provider}/callback`;
}

export function getGoogle(): Google {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Google OAuth is not configured (GOOGLE_OAUTH_CLIENT_ID/SECRET)");
  }
  return new Google(id, secret, redirectURI("google"));
}

export function getMicrosoft(): MicrosoftEntraId {
  const id = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const secret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  const tenant = process.env.MICROSOFT_OAUTH_TENANT ?? "common";
  if (!id || !secret) {
    throw new Error(
      "Microsoft OAuth is not configured (MICROSOFT_OAUTH_CLIENT_ID/SECRET)",
    );
  }
  return new MicrosoftEntraId(tenant, id, secret, redirectURI("microsoft"));
}
