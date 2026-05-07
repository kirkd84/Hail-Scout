import type { Appearance } from "@clerk/types";

/**
 * Shared Clerk appearance overrides for sign-in / sign-up.
 *
 * Clerk's default text colors are gray-900 in light mode and don't
 * auto-flip when our `.dark` class lands on <html>. The result was
 * a near-invisible "Sign in to Hail Scout" title and a cream-colored
 * footer panel sitting on top of the dark card. Every text element
 * here pins to one of our shadcn semantic tokens so it renders
 * correctly in both themes.
 */
export const clerkAppearance: Appearance = {
  elements: {
    rootBox: "w-full max-w-md",
    card: "bg-card border border-border shadow-atlas-lg rounded-xl",
    headerTitle: "font-display tracking-tight-display text-card-foreground",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButton:
      "border border-border bg-card hover:bg-secondary text-card-foreground",
    socialButtonsBlockButtonText: "text-card-foreground",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground",
    formFieldLabel: "text-card-foreground",
    formFieldInput:
      "bg-background border border-border text-foreground placeholder:text-muted-foreground",
    formFieldHintText: "text-muted-foreground",
    formButtonPrimary:
      "bg-primary hover:bg-teal-900 text-primary-foreground rounded-md normal-case",
    footer: "bg-card border-t border-border",
    footerAction: "text-muted-foreground",
    footerActionText: "text-muted-foreground",
    footerActionLink: "text-copper hover:text-copper-700",
    identityPreviewText: "text-card-foreground",
    identityPreviewEditButton: "text-copper hover:text-copper-700",
    formResendCodeLink: "text-copper hover:text-copper-700",
  },
};
