import * as Sentry from "@sentry/nextjs";

// Client-side error + performance reporting. Completely inert until
// NEXT_PUBLIC_SENTRY_DSN is set on the web deployment (Vercel) — so this is a
// no-op in dev and before launch. Next 15 auto-loads this file on the client.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? "production",
    tracesSampleRate: 0.1,
    // Don't ship PII (addresses, emails) by default.
    sendDefaultPii: false,
  });
}
