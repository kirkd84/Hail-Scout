import { UserButton } from "@clerk/nextjs";
import { EmptyState } from "@/components/app/empty-state";
import { IconSettings, IconUsers } from "@/components/icons";

export default function SettingsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-3xl py-10 space-y-8">
        <div>
          <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">Settings</p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tight-display text-foreground">
            Account &amp; workspace
          </h1>
        </div>
        <div className="rule-atlas" />

        {/* Account card */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">Account</p>
              <h2 className="mt-1 font-display text-2xl font-medium tracking-tight-display">Your profile</h2>
              <p className="mt-1 text-sm text-muted-foreground">Manage email, password, and sign-out from the avatar menu.</p>
            </div>
            <UserButton appearance={{ elements: { avatarBox: "h-10 w-10 ring-1 ring-border" } }} />
          </div>
        </section>

        {/* Organization placeholder */}
        <EmptyState
          icon={IconUsers}
          eyebrow="Coming soon"
          title="Workspace settings"
          description="Invite teammates, set roles (owner / admin / member), pick a default territory, and manage your branding for Hail Impact Reports."
          secondary={{ label: "Talk to us", href: "mailto:hello@hailscout.com" }}
        />
      </div>
    </div>
  );
}
