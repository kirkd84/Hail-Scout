import * as Sentry from "@sentry/nextjs";

// Server + edge error reporting. Inert until a DSN is set (SENTRY_DSN, or the
// public one). Next runs `register()` once per runtime at startup, and
// `onRequestError` captures thrown errors in server components / route
// handlers (Next 15).
export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? "production",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

export const onRequestError = Sentry.captureRequestError;
