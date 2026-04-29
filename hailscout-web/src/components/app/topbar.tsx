"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { IconCommand, IconSearch } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Topbar — minimal. Just a breadcrumb crumb (the current page name)
 * and the user button. Search lives in the page itself (the map page
 * has its own glass-morphism search), so we don't duplicate it here.
 *
 * Cmd-K hint is decorative for now — opens a no-op dropdown. Wire to
 * a real command palette in a future pass.
 */
const PAGE_TITLES: Record<string, string> = {
  "/app/map":       "Atlas",
  "/app/addresses": "Addresses",
  "/app/markers":   "Markers",
  "/app/reports":   "Reports",
  "/app/settings":  "Settings",
  "/super-admin/orgs":  "Tenant management",
  "/super-admin/users": "Super-admins",
  "/super-admin/usage": "Usage",
};

function pageTitleFor(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Closest prefix match
  const prefix = Object.keys(PAGE_TITLES).find((k) => pathname.startsWith(k));
  return prefix ? PAGE_TITLES[prefix] : "HailScout";
}

export function Topbar() {
  const pathname = usePathname();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    }
  }, []);

  const title = pageTitleFor(pathname);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-14 border-b border-border bg-background/85 backdrop-blur",
        "supports-[backdrop-filter]:bg-background/65",
      )}
    >
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="font-display text-lg font-medium tracking-tight-display text-foreground truncate">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Cmd-K trigger — currently a hint, becomes a real palette later */}
          <button
            type="button"
            className={cn(
              "hidden md:inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5",
              "text-xs text-muted-foreground transition-colors hover:border-copper/40 hover:text-foreground",
            )}
            aria-label="Open command palette"
          >
            <IconSearch className="h-3.5 w-3.5" />
            <span>Search</span>
            <span className="ml-3 inline-flex items-center gap-0.5 font-mono text-[10px] text-foreground/50">
              {isMac ? "⌘" : "Ctrl"} <span>K</span>
            </span>
          </button>

          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "h-8 w-8 ring-1 ring-border",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
