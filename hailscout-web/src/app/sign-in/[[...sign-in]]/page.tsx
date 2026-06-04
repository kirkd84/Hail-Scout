import { Suspense } from "react";
import { ContourBg } from "@/components/brand/contour-bg";
import { Wordmark } from "@/components/brand/wordmark";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

export default function SignInPage() {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <ContourBg className="opacity-90" density="sparse" fadeBottom={false} />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="mb-8">
          <Wordmark size="lg" pulse />
        </div>
        <h1 className="mb-6 font-display text-2xl font-medium tracking-tight-display text-foreground">
          Sign in to HailScout
        </h1>
        <Suspense fallback={null}>
          <OAuthButtons />
        </Suspense>
        <p className="mt-8 text-xs text-muted-foreground">
          Storm intelligence · 2026
        </p>
      </div>
    </div>
  );
}
