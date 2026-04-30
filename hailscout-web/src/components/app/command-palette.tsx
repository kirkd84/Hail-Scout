"use client";

import { useEffect, useState, useMemo } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useClerk } from "@clerk/nextjs";
import { useMe } from "@/hooks/useMe";
import { STORM_FIXTURES } from "@/lib/storm-fixtures";
import {
  IconMap, IconAddresses, IconFlag, IconReport, IconSettings,
  IconUsers, IconSearch, IconLayers, IconClose, IconPin, IconBolt,
} from "@/components/icons";

interface PaletteContextProps {
  open: boolean;
  setOpen: (next: boolean) => void;
}

/**
 * Cmd-K / Ctrl-K command palette.
 *
 * Wired globally by the AppLayout — keyboard shortcut toggles open. The
 * topbar's "Search" button can also call setOpen(true) (passed via context
 * in a future pass; for now it just hints visually).
 *
 * Sections:
 *  - Pages (Atlas, Addresses, Markers, Reports, Settings)
 *  - Storms (the fixture cities — fly to that storm)
 *  - Super-admin (only when user.is_super_admin)
 *  - Theme (light / dark / system)
 *  - Account (sign out)
 */
export function CommandPalette({ open, setOpen }: PaletteContextProps) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { signOut } = useClerk();
  const { me } = useMe();

  // Global Cmd-K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        // The address-search component listens for the same combo when focused
        // — we still steal it for the palette unless the user is typing in it.
        const target = e.target as HTMLElement | null;
        const inSearch = target?.closest('input[aria-label="Search address"]');
        if (inSearch) return;
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  const stormItems = useMemo(
    () =>
      STORM_FIXTURES.map((s) => ({
        id: s.id,
        title: s.city,
        sub: `${s.max_hail_size_in.toFixed(2)}″ · ${new Date(s.start_time).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}`,
        lng: s.centroid_lng,
        lat: s.centroid_lat,
      })),
    [],
  );

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const flyToStorm = (lng: number, lat: number) => {
    setOpen(false);
    // Only the map page can fly. If we're elsewhere, navigate then dispatch.
    sessionStorage.setItem("hs.flyto", JSON.stringify({ lng, lat, zoom: 9 }));
    router.push("/app/map");
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh] bg-background/55 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-panel"
      >
        <Command label="Command palette" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide-caps [&_[cmdk-group-heading]]:text-copper">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <IconSearch className="h-4 w-4 text-foreground/55" />
            <Command.Input
              autoFocus
              placeholder="Search pages, storms, actions…"
              className="flex-1 bg-transparent text-base text-foreground placeholder:text-foreground/45 outline-none"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-foreground/40 transition-colors hover:text-foreground"
              aria-label="Close palette"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-1.5">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches.
            </Command.Empty>

            <Command.Group heading="Pages">
              <Item icon={<IconMap className="h-4 w-4" />}        onSelect={() => go("/app/map")}>The atlas (map)</Item>
              <Item icon={<IconAddresses className="h-4 w-4" />}  onSelect={() => go("/app/addresses")}>Monitored addresses</Item>
              <Item icon={<IconFlag className="h-4 w-4" />}       onSelect={() => go("/app/markers")}>Canvassing markers</Item>
              <Item icon={<IconReport className="h-4 w-4" />}     onSelect={() => go("/app/reports")}>Hail Impact Reports</Item>
              <Item icon={<IconBolt className="h-4 w-4 text-copper" />} onSelect={() => go("/app/photo-ai")}>Photo damage triage</Item>
              <Item icon={<IconSettings className="h-4 w-4" />}   onSelect={() => go("/app/settings")}>Settings</Item>
            </Command.Group>

            <Command.Group heading="Recent storms">
              {stormItems.map((s) => (
                <Item
                  key={s.id}
                  icon={<IconPin className="h-4 w-4 text-copper" />}
                  onSelect={() => flyToStorm(s.lng, s.lat)}
                  trailing={<span className="font-mono-num text-[11px] text-foreground/55">{s.sub}</span>}
                >
                  {s.title}
                </Item>
              ))}
            </Command.Group>

            {me?.user?.is_super_admin && (
              <Command.Group heading="Super-admin">
                <Item icon={<IconUsers className="h-4 w-4 text-copper" />}  onSelect={() => go("/super-admin/orgs")}>Organizations</Item>
                <Item icon={<IconUsers className="h-4 w-4 text-copper" />}  onSelect={() => go("/super-admin/users")}>Super-admins</Item>
                <Item icon={<IconReport className="h-4 w-4 text-copper" />} onSelect={() => go("/super-admin/usage")}>Usage &amp; billing</Item>
              </Command.Group>
            )}

            <Command.Group heading="Theme">
              <Item icon={<IconLayers className="h-4 w-4" />} onSelect={() => { setTheme("light"); setOpen(false); }}>Light</Item>
              <Item icon={<IconLayers className="h-4 w-4" />} onSelect={() => { setTheme("dark");  setOpen(false); }}>Dark</Item>
              <Item icon={<IconLayers className="h-4 w-4" />} onSelect={() => { setTheme("system"); setOpen(false); }}>System</Item>
            </Command.Group>

            <Command.Group heading="Account">
              <Item
                icon={<IconClose className="h-4 w-4 text-destructive" />}
                onSelect={async () => { setOpen(false); await signOut({ redirectUrl: "/" }); }}
              >
                Sign out
              </Item>
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] font-mono uppercase tracking-wide-caps text-foreground/45">
            <span>HailScout · ⌘K</span>
            <span><kbd className="rounded bg-foreground/10 px-1.5 py-0.5">↵</kbd> select · <kbd className="rounded bg-foreground/10 px-1.5 py-0.5">esc</kbd> close</span>
          </div>
        </Command>
      </div>
    </div>
  );
}

interface ItemProps {
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  onSelect: () => void | Promise<void>;
  children: React.ReactNode;
}

function Item({ icon, trailing, onSelect, children }: ItemProps) {
  return (
    <Command.Item
      onSelect={() => {
        void onSelect();
      }}
      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-copper/10 aria-selected:text-foreground hover:bg-foreground/5"
    >
      <span className="text-foreground/55">{icon}</span>
      <span className="flex-1 truncate">{children}</span>
      {trailing}
    </Command.Item>
  );
}
