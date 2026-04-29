import { SignUp } from "@clerk/nextjs";
import { ContourBg } from "@/components/brand/contour-bg";
import { Wordmark } from "@/components/brand/wordmark";

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
        </p>
        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full max-w-md",
              card: "bg-card border border-border shadow-atlas-lg rounded-xl",
              headerTitle: "font-display tracking-tight-display",
              formButtonPrimary:
                "bg-primary hover:bg-teal-900 text-primary-foreground rounded-md normal-case",
              footerActionLink: "text-copper hover:text-copper-700",
            },
          }}
        />
      </div>
    </div>
  );
}
