/**
 * Server-only OAuth provider config (Arctic).
 *
 * Client *secrets* live here in the web tier — Arctic runs the code-exchange
 * server-side. The API never sees them; it only verifies the resulting
 * provider id_token. Redirect URIs must EXACTLY match what's registered in the
 * Google Cloud / Azure app registrations.
 */
import { Apple, Google, MicrosoftEntraId } from "arctic";

export const OAUTH_SCOPES = ["openid", "profile", "email"];

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://hail-scout-production.up.railway.app";

/** Public base URL of the web app (for OAuth redirect URIs). */
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export type ProviderName = "google" | "microsoft" | "apple";

export function isProvider(p: string): p is ProviderName {
  return p === "google" || p === "microsoft" || p === "apple";
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

/**
 * Sign in with Apple (web / Services ID flow) — completely DARK until all
 * four APPLE_* envs are staged. Gates both the sign-in button and the
 * /api/auth/apple routes.
 */
export function isAppleConfigured(): boolean {
  return Boolean(
    process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY,
  );
}

/** Decode the PKCS#8 .p8 PEM into the raw bytes Arctic's Apple client wants. */
function applePrivateKeyBytes(pem: string): Uint8Array {
  const body = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  return new Uint8Array(Buffer.from(body, "base64"));
}

export function getApple(): Apple {
  const clientId = process.env.APPLE_CLIENT_ID; // the Services ID, not the App ID
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY; // the .p8 PEM
  if (!clientId || !teamId || !keyId || !privateKey) {
    throw new Error(
      "Apple OAuth is not configured (APPLE_CLIENT_ID/TEAM_ID/KEY_ID/PRIVATE_KEY)",
    );
  }
  // Arctic mints the short-lived ES256 client-secret JWT from the .p8
  // (iss = team id, sub = Services ID, kid = key id) at code-exchange time.
  return new Apple(
    clientId,
    teamId,
    keyId,
    applePrivateKeyBytes(privateKey),
    redirectURI("apple"),
  );
}
