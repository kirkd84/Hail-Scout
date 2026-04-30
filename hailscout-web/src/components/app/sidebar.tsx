"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useMe } from "@/hooks/useMe";
import { Wordmark } from "@/components/brand/wordmark";
import {
  IconMap,
  IconCompass,
  IconAddresses,
  IconFlag,
  IconReport,
  IconSettings,
  IconUsers,
  IconBolt,
} from "@/components/icons";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const APP_NAV: NavItem[] = [
  { label: "Overview",    href: "/app",           icon: IconCompass },
  { label: "Map",         href: "/app/map",       icon: IconMap },
  { label: "Addresses",   href: "/app/addresses", icon: IconAddresses },
  { label: "Alerts",      href: "/app/alerts",    icon: IconBolt },
  { label: "Markers",     href: "/app/markers",   icon: IconFlag },
  { label: "Reports",     href: "/app/reports",   icon: IconReport },
  { label: "Photo AI",    href: "/app/photo-ai",  icon: IconBolt },
];

export function Sidebar() {
  const pathname = usePathname();
  const { me } = useMe();
  const isSuperAdmin = me?.user?.is_super_admin === true;

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col h-screen border-r border-border bg-card relative">
      {/* Subtle topo accent at the top of the sidebar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-50">
        <svg className="h-full w-full" viewBox="0 0 240 128" preserveAspectRatio="none" aria-hidden>
          <path d="M-10,30 Q60,18 130,28 T260,22"  fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.6" opacity="0.25" />
          <path d="M-10,52 Q60,40 130,48 T260,42"  fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.6" opacity="0.18" />
          <path d="M-10,78 Q60,68 130,72 T260,66"  fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.6" opacity="0.12" />
          <path d="M-10,98 Q60,90 130,94 T260,86"  fill="none" stroke="hsl(var(--teal-700))" strokeWidth="0.5" opacity="0.08" />
        </svg>
      </div>

      <div className="relative flex flex-col h-full">
        <div className="px-5 py-5">
          <Wordmark size="md" pulse href="/app" />
        </div>
        <div className="rule-atlas mx-5" />

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {APP_NAV.map((item) => {
            const isActive =
              item.href === "/app"
                ? pathname === "/app"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-atlas"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive ? "text-primary-foreground" : "text-foreground/60 group-hover:text-foreground",
                  )}
                />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-copper" aria-hidden />
                )}
              </Link>
            );
          })}
        </nav>

        {isSuperAdmin && (
          <div className="px-3 py-3 border-t border-border">
            <p className="px-3 mb-2 text-[10px] font-mono uppercase tracking-wide-caps text-copper">
              Super-admin
            </p>
            <Link
              href="/super-admin/orgs"
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all border",
                pathname.startsWith("/super-admin")
                  ? "border-copper bg-copper/10 text-foreground"
                  : "border-transparent text-muted-foreground hover:border-copper/40 hover:bg-copper/5 hover:text-foreground",
              )}
            >
              <IconUsers className="h-4 w-4 shrink-0 text-copper" />
              <span className="font-medium">Tenant management</span>
            </Link>
          </div>
        )}

        <div className="border-t border-border px-3 py-3">
          <Link
            href="/app/settings"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              pathname.startsWith("/app/settings")
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <IconSettings className="h-4 w-4 shrink-0" />
            <span className="font-medium">Settings</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
