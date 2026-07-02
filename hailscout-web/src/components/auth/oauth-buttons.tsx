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

export function OAuthButtons({
  appleEnabled = false,
}: {
  /**
   * Server-computed (isAppleConfigured): Sign in with Apple stays completely
   * dark until all four APPLE_* envs are staged.
   */
  appleEnabled?: boolean;
}) {
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

      {appleEnabled && (
        <a
          href="/api/auth/apple"
          className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-secondary"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M16.365 12.79c-.024-2.462 2.012-3.645 2.103-3.703-1.145-1.674-2.926-1.903-3.559-1.929-1.514-.153-2.955.892-3.722.892-.766 0-1.952-.87-3.209-.846-1.65.024-3.172.959-4.021 2.436-1.714 2.972-.438 7.376 1.232 9.789.816 1.181 1.789 2.508 3.066 2.46 1.23-.049 1.695-.796 3.183-.796 1.487 0 1.905.796 3.208.771 1.325-.024 2.163-1.203 2.973-2.389.937-1.371 1.322-2.699 1.345-2.767-.029-.013-2.58-.99-2.599-3.918zM13.917 5.56c.678-.822 1.136-1.963 1.011-3.101-.977.04-2.161.651-2.862 1.472-.63.728-1.18 1.891-1.032 3.006 1.09.085 2.204-.554 2.883-1.377z" />
          </svg>
          Continue with Apple
        </a>
      )}

      <p className="pt-1 text-center text-xs text-muted-foreground">
        {appleEnabled
          ? "Use the Google, Microsoft, or Apple account tied to your work email."
          : "Use the Google or Microsoft account tied to your work email."}
      </p>
    </div>
  );
}
