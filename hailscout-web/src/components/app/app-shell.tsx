"use client";

import { useState } from "react";
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
