import { Suspense } from "react";
import { ContourBg } from "@/components/brand/contour-bg";
import { Wordmark } from "@/components/brand/wordmark";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { isAppleConfigured } from "@/lib/auth/providers";

export default function SignUpPage() {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <ContourBg className="opacity-90" density="sparse" fadeBottom={false} />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="mb-8">
          <Wordmark size="lg" pulse />
        </div>
        <p className="mb-6 text-center text-sm text-muted-foreground max-w-sm">
          Welcome to HailScout. The field guide your crew opens every morning.
          Sign in with the work account your administrator added.
        </p>
        <Suspense fallback={null}>
          <OAuthButtons appleEnabled={isAppleConfigured()} />
        </Suspense>
      </div>
    </div>
  );
}
