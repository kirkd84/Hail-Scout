import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Wordmark } from "@/components/brand/wordmark";
import { IconUsers, IconReport } from "@/components/icons";

const SUPER_ADMIN_NAV = [
  { href: "/super-admin/orgs",  label: "Organizations",  icon: IconUsers },
  { href: "/super-admin/users", label: "Super-admins",   icon: IconUsers },
  { href: "/super-admin/usage", label: "Usage & billing", icon: IconReport },
  { href: "/super-admin/audit", label: "Audit log",      icon: IconReport },
] as const;

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/super-admin/orgs");

  return (
    <div className="min-h-screen bg-background">
      {/* Copper top bar — visually marks "you are in cross-tenant land" */}
      <header className="border-b border-copper/30 bg-card">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Wordmark size="sm" />
            <span className="text-foreground/35">/</span>
            <span className="inline-flex items-center gap-2 text-sm">
              <span className="font-mono text-[10px] uppercase tracking-wide-caps rounded-md bg-copper/15 text-copper-700 px-2 py-0.5 ring-1 ring-copper/30">
                Super
              </span>
              <span className="text-foreground font-medium">Tenant management</span>
            </span>
          </div>
          <Link
            href="/app/map"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <span aria-hidden>←</span> Back to app
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
        <nav className="space-y-0.5">
          <p className="px-3 mb-3 text-[10px] font-mono uppercase tracking-wide-caps text-copper">
            Cross-tenant
          </p>
          {SUPER_ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Icon className="h-4 w-4 text-foreground/50 group-hover:text-copper" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <main>{children}</main>
      </div>
    </div>
  );
}
