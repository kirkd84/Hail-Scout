"use client";

/**
 * /app/settings — tabbed settings shell.
 *
 * Sections:
 *   • Profile      — Clerk UserButton, account info
 *   • Workspace    — branding card, default territory (future)
 *   • Integrations — Slack, future webhooks
 *   • Notifications— alert thresholds, tour resets
 *   • Help         — welcome tours + shortcut reference link
 *
 * Tabs are URL-driven via ?tab= so links from elsewhere can deep-link to a
 * specific tab (e.g. integrations).
 */

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useMe } from "@/hooks/useMe";
import { BrandingCard } from "@/components/app/branding-card";
import { SlackCard } from "@/components/app/slack-card";
import { cn } from "@/lib/utils";
import {
  IconUser,
  IconSettings,
  IconBolt,
  IconUsers,
  IconCommand,
} from "@/components/icons";

type Tab = "profile" | "workspace" | "integrations" | "notifications" | "help";

const TABS: Array<{
  id: Tab;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  description: string;
}> = [
  { id: "profile",       label: "Profile",       icon: IconUser,    description: "Email, password, sign-out" },
  { id: "workspace",     label: "Workspace",     icon: IconSettings, description: "Org branding, defaults" },
  { id: "integrations",  label: "Integrations",  icon: IconBolt,    description: "Slack and webhooks" },
  { id: "notifications", label: "Notifications", icon: IconBolt,    description: "Alert thresholds" },
  { id: "help",          label: "Help",          icon: IconUsers,   description: "Tours, shortcuts, support" },
];

function isTab(v: string | null): v is Tab {
  return v === "profile" || v === "workspace" || v === "integrations" || v === "notifications" || v === "help";
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full overflow-y-auto">
          <div className="container max-w-4xl py-10 text-sm text-muted-foreground">
            Loading…
          </div>
        </div>
      }
    >
      <SettingsInner />
    </Suspense>
  );
}

function SettingsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initial: Tab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "profile";
  const [tab, setTab] = useState<Tab>(initial);

  function setTabAndUrl(t: Tab) {
    setTab(t);
    // Update URL without re-rendering layout
    const sp = new URLSearchParams(Array.from(params.entries()));
    sp.set("tab", t);
    router.replace(`/app/settings?${sp.toString()}`, { scroll: false });
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-5xl py-10 space-y-6">
        <div>
          <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
            Settings
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
            Account &amp; workspace
          </h1>
        </div>
        <div className="rule-atlas" />

        <div className="grid gap-8 md:grid-cols-[200px_1fr]">
          {/* Tab nav (left rail on md+, top scroll on mobile) */}
          <nav className="md:sticky md:top-4 md:self-start">
            <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-1 md:mx-0">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setTabAndUrl(t.id)}
                      className={cn(
                        "w-full md:w-auto md:min-w-[180px] flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all whitespace-nowrap",
                        active
                          ? "bg-primary text-primary-foreground shadow-atlas"
                          : "text-foreground/70 hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{t.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="space-y-6 min-w-0">
            {tab === "profile" && <ProfileTab />}
            {tab === "workspace" && <WorkspaceTab />}
            {tab === "integrations" && <IntegrationsTab />}
            {tab === "notifications" && <NotificationsTab />}
            {tab === "help" && <HelpTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Tabs ----------

function ProfileTab() {
  const { me } = useMe();
  return (
    <SectionCard
      eyebrow="Account"
      title="Your profile"
      description="Manage email, password, two-factor, and sign-out from the avatar menu."
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          {me?.user?.email && (
            <p className="font-mono-num text-sm text-foreground">{me.user.email}</p>
          )}
          {me?.user?.role && (
            <p className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55">
              Role: {me.user.role.replace("_", " ")}
            </p>
          )}
          {me?.organization?.name && (
            <p className="text-xs text-foreground/55">{me.organization.name}</p>
          )}
        </div>
        <UserButton
          appearance={{ elements: { avatarBox: "h-10 w-10 ring-1 ring-border" } }}
        />
      </div>
    </SectionCard>
  );
}

function WorkspaceTab() {
  return (
    <>
      <BrandingCard />
      <SectionCard
        eyebrow="Defaults"
        title="Default map view"
        description="Coming soon — set the default basemap and bookmarked region every teammate sees on first load."
      >
        <p className="text-sm text-foreground/55">
          For now, the map remembers the last layer you used.
        </p>
      </SectionCard>
      <SectionCard
        eyebrow="Team"
        title="Team management"
        description="Invite teammates and set their roles."
      >
        <Link
          href="/app/team"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-teal-900"
        >
          Open team page <span aria-hidden>→</span>
        </Link>
      </SectionCard>
    </>
  );
}

function IntegrationsTab() {
  return (
    <>
      <SlackCard />
      <SectionCard
        eyebrow="Coming soon"
        title="Webhook receivers"
        description="Pipe storm alerts to Zapier, Make, n8n, or any HTTPS endpoint. Same payload format as the Slack integration."
      >
        <p className="text-sm text-foreground/55">
          Email <span className="font-mono">hello@hailscout.com</span> if you
          need this today and we'll wire it up by hand.
        </p>
      </SectionCard>
      <SectionCard
        eyebrow="API"
        title="API tokens"
        description="Generate a personal access token for read-only API queries (markers, addresses, alerts)."
      >
        <p className="text-sm text-foreground/55">
          On the way. The full OpenAPI spec is at{" "}
          <span className="font-mono">/v1/openapi.json</span>.
        </p>
      </SectionCard>
    </>
  );
}

function NotificationsTab() {
  return (
    <>
      <SectionCard
        eyebrow="Alerts"
        title="Hail size threshold"
        description="The minimum hail size that triggers a storm alert for any of your monitored addresses."
      >
        <p className="text-sm text-foreground/55">
          Set per-address on the addresses page. Default org-wide threshold:{" "}
          <span className="font-mono-num font-medium text-foreground">1.00″</span>
          .
        </p>
        <Link
          href="/app/addresses"
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide-caps text-copper hover:text-copper-700"
        >
          Open monitored addresses →
        </Link>
      </SectionCard>
      <SectionCard
        eyebrow="Cadence"
        title="Email digests"
        description="Coming soon — daily or weekly digest of new hail hits across your watchlist."
      >
        <p className="text-sm text-foreground/55">
          Today: real-time alerts only, in-app + Slack.
        </p>
      </SectionCard>
    </>
  );
}

function HelpTab() {
  const resetTour = () => {
    try {
      localStorage.removeItem("hs.welcome-tour.v1");
    } catch {}
    window.location.href = "/app/map";
  };
  const resetOnboarding = () => {
    try {
      localStorage.removeItem("hs.onboarding.v1");
    } catch {}
    window.location.href = "/app";
  };

  return (
    <>
      <SectionCard
        eyebrow="Tours"
        title="Replay the welcome tours"
        description="Walk through the map or the onboarding wizard again."
      >
        <div className="flex flex-wrap gap-2">
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
      </SectionCard>
      <SectionCard
        eyebrow="Reference"
        title="Keyboard shortcuts"
        description="The full shortcut sheet."
      >
        <p className="text-sm text-foreground/65 inline-flex items-center gap-2">
          Press <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary/40 font-mono text-[11px]">?</kbd>{" "}
          anywhere in the app, or{" "}
          <span className="inline-flex items-center gap-1">
            <IconCommand className="h-3.5 w-3.5" />
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary/40 font-mono text-[11px]">K</kbd>
          </span>{" "}
          to open the command palette.
        </p>
      </SectionCard>
      <SectionCard
        eyebrow="Support"
        title="Talk to a real person"
        description="No tickets. No queue. Email a founder and you'll hear back in hours, not days."
      >
        <a
          href="mailto:hello@hailscout.com"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-teal-900"
        >
          hello@hailscout.com <span aria-hidden>↗</span>
        </a>
      </SectionCard>
    </>
  );
}

// ---------- Building blocks ----------

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">
        {eyebrow}
      </p>
      <h2 className="mt-1 font-display text-2xl font-medium tracking-tight-display">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}
