"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP_NAV } from "@/lib/constants";
import { useMe } from "@/hooks/useMe";

export function Sidebar() {
  const pathname = usePathname();
  const { me } = useMe();

  return (
    <aside className="hidden border-r bg-muted/40 md:block w-64 h-screen sticky top-0">
      <div className="flex flex-col h-full">
        <div className="p-6 border-b">
          <Link href="/app" className="flex items-center gap-2 font-semibold text-lg">
            <div className="h-8 w-8 bg-primary rounded-lg" />
            HailScout
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          {APP_NAV.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {me?.user.is_super_admin && (
          <div className="border-t p-4">
            <Link
              href="/super-admin/orgs"
              className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-900 hover:bg-amber-500/20 dark:text-amber-200"
            >
              <span className="font-mono text-[10px] uppercase tracking-wider rounded bg-amber-500/30 px-1.5 py-0.5">
                Super
              </span>
              Tenant management
            </Link>
          </div>
        )}

        <div className="border-t p-4">
          <Link href="/app/settings" className="text-sm text-muted-foreground hover:text-foreground">
            Settings
          </Link>
        </div>
      </div>
    </aside>
  );
}
