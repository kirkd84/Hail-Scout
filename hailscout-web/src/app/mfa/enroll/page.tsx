"use client";

/**
 * Forced MFA enrollment (LOGIN-STANDARD §4): an owner/admin whose 7-day
 * grace window lapsed lands here after a correct password. Their access
 * cookie holds an enrollment-scoped token the API rejects everywhere except
 * the MFA enrollment endpoints — so this page is intentionally outside the
 * /app shell. After enrolling they sign in again (this time with a code).
 */

import { useRouter } from "next/navigation";
import { ContourBg } from "@/components/brand/contour-bg";
import { Wordmark } from "@/components/brand/wordmark";
import { MfaEnrollFlow } from "@/components/app/security-card";

export default function MfaEnrollPage() {
  const router = useRouter();

  const finish = async () => {
    // Drop the enrollment-scoped cookie and start a clean sign-in (which
    // will now text a code).
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* best-effort */
    }
    router.replace("/sign-in");
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <ContourBg className="opacity-90" density="sparse" fadeBottom={false} />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="mb-8">
          <Wordmark size="lg" />
        </div>
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6">
          <h1 className="font-display text-2xl font-medium tracking-tight-display text-foreground">
            Set up two-factor to continue
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your role requires a texted sign-in code for password logins, and
            the enrollment grace period has ended. Verify your mobile number
            below, then sign in again.
          </p>
          <div className="mt-5">
            <MfaEnrollFlow onDone={() => void finish()} />
          </div>
        </div>
      </div>
    </div>
  );
}
