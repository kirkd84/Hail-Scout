"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/useMe";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/**
 * Account avatar + menu — replaces Clerk's <UserButton/>. Shows the signed-in
 * email + org and offers Settings / Sign out.
 */
export function UserMenu({ className }: { className?: string }) {
  const { me } = useMe();
  const { signOut } = useAuth();
  const router = useRouter();

  const email = me?.user?.email ?? "";
  const initials = email ? email.slice(0, 2).toUpperCase() : "··";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium text-foreground ring-1 ring-border transition-colors hover:ring-copper/40",
            className,
          )}
        >
          {initials}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[208px] rounded-lg border border-border bg-card p-1 shadow-atlas-lg"
        >
          <div className="px-3 py-2">
            <p className="font-mono-num text-xs text-foreground truncate">
              {email || "Signed in"}
            </p>
            {me?.organization?.name && (
              <p className="text-[11px] text-muted-foreground truncate">
                {me.organization.name}
              </p>
            )}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <button
              type="button"
              onClick={() => router.push("/app/settings")}
              className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-secondary"
            >
              Settings
            </button>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <button
              type="button"
              onClick={() => signOut(() => router.push("/"))}
              className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-destructive/10 hover:text-destructive"
            >
              Sign out
            </button>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
