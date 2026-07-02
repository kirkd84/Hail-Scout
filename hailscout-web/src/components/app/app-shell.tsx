"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { CommandPalette } from "@/components/app/command-palette";
import { ToastHost } from "@/components/app/toast-host";
import { AlertWatcher } from "@/components/app/alert-watcher";
import { ShortcutsModal } from "@/components/app/shortcuts-modal";

/**
 * Authenticated app shell (client). Wires the global Cmd-K command palette;
 * the surrounding layout is a thin server component that marks the segment
 * dynamic.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  // Expired/absent session → go sign in. Without this the app half-renders
  // (public map data loads, everything authed silently empties, and writes
  // fail with a bare "API 401") — which reads as the app being broken.
  useEffect(() => {
    if (isLoaded && isSignedIn === false) {
      router.replace("/sign-in?expired=1");
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <ToastHost>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Topbar onSearchClick={() => setPaletteOpen(true)} />
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
        <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} />
        <AlertWatcher />
        <ShortcutsModal />
      </div>
    </ToastHost>
  );
}
