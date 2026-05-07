import { SignIn } from "@clerk/nextjs";
import { ContourBg } from "@/components/brand/contour-bg";
import { Wordmark } from "@/components/brand/wordmark";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <ContourBg className="opacity-90" density="sparse" fadeBottom={false} />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="mb-8">
          <Wordmark size="lg" pulse />
        </div>
        <SignIn appearance={clerkAppearance} />
        <p className="mt-8 text-xs text-muted-foreground">
          Storm intelligence · 2026
        </p>
      </div>
    </div>
  );
}
