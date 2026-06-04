"use client";

import { useSearchParams } from "next/navigation";

const ERROR_COPY: Record<string, string> = {
  no_account:
    "No HailScout account exists for that email yet. Ask your administrator to add you, then sign in again.",
  invalid_state: "Your sign-in session expired. Please try again.",
  oauth_failed:
    "We couldn't complete sign-in with that provider. Please try again.",
  exchange_failed: "Sign-in failed. Please try again.",
  exchange_unreachable:
    "Our servers are unreachable right now. Please try again in a moment.",
};

export function OAuthButtons() {
  const params = useSearchParams();
  const err = params.get("error");

  return (
    <div className="w-full max-w-sm space-y-3">
      {err && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {ERROR_COPY[err] ?? "Sign-in failed. Please try again."}
        </p>
      )}

      <a
        href="/api/auth/google"
        className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-secondary"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
        Continue with Google
      </a>

      <a
        href="/api/auth/microsoft"
        className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-secondary"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <path fill="#F25022" d="M0 0h8.5v8.5H0z" />
          <path fill="#7FBA00" d="M9.5 0H18v8.5H9.5z" />
          <path fill="#00A4EF" d="M0 9.5h8.5V18H0z" />
          <path fill="#FFB900" d="M9.5 9.5H18V18H9.5z" />
        </svg>
        Continue with Microsoft
      </a>

      <p className="pt-1 text-center text-xs text-muted-foreground">
        Use the Google or Microsoft account tied to your work email.
      </p>
    </div>
  );
}
