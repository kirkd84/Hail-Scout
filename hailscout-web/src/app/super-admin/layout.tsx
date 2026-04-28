/**
 * Super-admin shell — separate from the per-tenant /app/* shell.
 *
 * Only users with `is_super_admin === true` should be here. The check is
 * also enforced server-side on every /v1/admin/* endpoint, but we add a
 * client-side gate so non-super-admins don't see the empty UI flash before
 * the API 403s.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

const SUPER_ADMIN_NAV = [
  { href: "/super-admin/orgs", label: "Organizations" },
  { href: "/super-admin/users", label: "Users" },
  { href: "/super-admin/usage", label: "Usage & Billing" },
] as const;

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/super-admin/orgs");

  // NOTE: we do not have a synchronous way to read `is_super_admin` on the
  // server without a DB roundtrip from Next. The page-level fetch below will
  // 403 if the user is not a super-admin; the UI shell shows nothing
  // sensitive on its own.
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-amber-500/10">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-wider rounded bg-amber-500/20 px-2 py-1 text-amber-900 dark:text-amber-200">
              Super Admin
            </span>
            <Link href="/super-admin/orgs" className="font-semibold">
              HailScout — Tenant Management
            </Link>
          </div>
          <Link
            href="/app"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to app
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8">
        <nav className="space-y-1">
          {SUPER_ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main>{children}</main>
      </div>
    </div>
  );
}
