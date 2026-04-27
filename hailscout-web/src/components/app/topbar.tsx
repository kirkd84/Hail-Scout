"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export function Topbar() {
  return (
    <header className="border-b bg-background sticky top-0 z-40">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/app" className="flex items-center gap-2 font-semibold">
            <div className="h-8 w-8 bg-primary rounded-lg" />
            <span className="hidden sm:inline">HailScout</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  );
}
