"use client";

import { UserButton } from "@clerk/nextjs";
import { EmptyState } from "@/components/app/empty-state";
import { BrandingCard } from "@/components/app/branding-card";
import { SlackCard } from "@/components/app/slack-card";
import { IconUsers } from "@/components/icons";

export default function SettingsPage() {
  const resetTour = () => {
    try {
      localStorage.removeItem("hs.welcome-tour.v1");
    } catch {
      // ignore
    }
    window.location.href = "/app/map";
  };

  const resetOnboarding = () => {
    try {
      localStorage.removeItem("hs.onboarding.v1");
    } catch {
      // ignore
    }
    window.location.href = "/app";
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-3xl py-10 space-y-8">
        <div>
          <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
            Settings
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tight-display text-foreground">
            Account &amp; workspace
          </h1>
        </div>
        <div className="rule-atlas" />

        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">
                Account
              </p>
              <h2 className="mt-1 font-display text-2xl font-medium tracking-tight-display">
                Your profile
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage email, password, and sign-out from the avatar menu.
              </p>
            </div>
            <UserButton appearance={{ elements: { avatarBox: "h-10 w-10 ring-1 ring-border" } }} />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">
            Help
          </p>
          <h2 className="mt-1 font-display text-2xl font-medium tracking-tight-display">
            Take the welcome tour again
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Replays the first-run guide explaining search, filters, drop-pin
            mode, and the command palette.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetTour}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-copper/50 hover:bg-muted"
            >
              Map tour <span aria-hidden>→</span>
            </button>
            <button
              type="button"
              onClick={resetOnboarding}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-copper/50 hover:bg-muted"
            >
              Onboarding wizard <span aria-hidden>→</span>
            </button>
          </div>
        </section>

        <BrandingCard />

        <SlackCard />

        <EmptyState
          icon={IconUsers}
          eyebrow="Coming soon"
          title="Team management"
          description="Invite teammates, set roles (owner / admin / member), and pick a default territory."
          secondary={{ label: "Talk to us", href: "mailto:hello@hailscout.com" }}
        />
      </div>
    </div>
  );
}
