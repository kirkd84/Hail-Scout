"use client";

import { useState } from "react";
import { useTeam, type TeamMember } from "@/hooks/useTeam";
import { useMe } from "@/hooks/useMe";
import { EmptyState } from "@/components/app/empty-state";
import { IconUsers, IconClose, IconChevronRight } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS = ["owner", "admin", "member"] as const;
type Role = typeof ROLE_OPTIONS[number];

const ROLE_TONE: Record<string, { color: string; bg: string; ring: string }> = {
  owner:  { color: "#0F4C5C", bg: "rgba(15, 76, 92, 0.10)",  ring: "rgba(15, 76, 92, 0.35)" },
  admin:  { color: "#7A4A0E", bg: "rgba(216, 124, 74, 0.12)", ring: "rgba(216, 124, 74, 0.45)" },
  member: { color: "#444441", bg: "rgba(107, 96, 82, 0.10)",  ring: "rgba(107, 96, 82, 0.30)" },
};

export default function TeamPage() {
  const { me } = useMe();
  const { members, updateRole, remove, invite, isLoading, error } = useTeam();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [inviteFlash, setInviteFlash] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const myId = me?.user?.id;
  const myRole = me?.user?.role;
  const canManage = myRole === "owner" || myRole === "admin" || me?.user?.is_super_admin === true;
  const canRemove = myRole === "owner" || me?.user?.is_super_admin === true;

  const handleInvite = async () => {
    setInviteBusy(true);
    setInviteFlash(null);
    try {
      await invite(inviteEmail.trim(), inviteRole);
      setInviteFlash(`Invite sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteOpen(false);
      setTimeout(() => setInviteFlash(null), 3000);
    } catch (e) {
      setInviteFlash(
        e instanceof Error && e.message ? e.message : "Failed to send invite",
      );
    } finally {
      setInviteBusy(false);
    }
  };

  if (error) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="container max-w-3xl py-10">
          <EmptyState
            icon={IconUsers}
            eyebrow="Team"
            title="Team data unavailable"
            description="The API didn't return a team list. This may be temporary — refresh in a moment."
            primary={{ label: "Refresh", href: "/app/team" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-5xl py-10 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
              Team
            </p>
            <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
              Your crew
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading ? "Loading…" : `${members.length} member${members.length === 1 ? "" : "s"}`} in your workspace.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setInviteOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900"
            >
              + Invite teammate
            </button>
          )}
        </div>

        <div className="rule-atlas" />

        {inviteOpen && canManage && (
          <div className="rounded-xl border border-copper/40 bg-copper/5 p-5 space-y-3">
            <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper-700">
              New invite
            </p>
            <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@yourcompany.com"
                className="rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-copper focus:outline-none"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-copper focus:outline-none"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleInvite()}
                disabled={inviteBusy || !inviteEmail.includes("@")}
                className="rounded-md bg-copper px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-copper-700 disabled:opacity-60"
              >
                {inviteBusy ? "Sending…" : "Send invite"}
              </button>
            </div>
            <p className="text-xs text-foreground/55">
              The invitee gets an email link to join your workspace. Email delivery is queued in this preview — production will integrate with Clerk invites.
            </p>
          </div>
        )}

        {inviteFlash && (
          <div className="rounded-md border border-forest/30 bg-forest/5 px-4 py-3 text-sm text-forest">
            {inviteFlash}
          </div>
        )}

        {/* Members list */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[3fr_140px_1fr_60px] border-b border-border bg-secondary/40 text-[11px] font-mono uppercase tracking-wide-caps text-foreground/65">
            <div className="px-5 py-3">Member</div>
            <div className="px-5 py-3">Role</div>
            <div className="px-5 py-3">Joined</div>
            <div className="px-5 py-3" />
          </div>

          {isLoading && (
            <>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="grid grid-cols-[3fr_140px_1fr_60px] items-center border-b border-border/60"
                >
                  <div className="px-5 py-3 flex items-center gap-3">
                    <Skeleton width={36} height={36} rounded="full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton width="50%" height={14} />
                      <Skeleton width="70%" height={10} subtle />
                    </div>
                  </div>
                  <div className="px-5 py-3"><Skeleton width={70} height={20} rounded="full" /></div>
                  <div className="px-5 py-3"><Skeleton width={80} height={10} subtle /></div>
                  <div className="px-5 py-3" />
                </div>
              ))}
            </>
          )}

          {!isLoading && members.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              No members yet.
            </div>
          )}

          {!isLoading && members.map((m, i) => {
            const tone = ROLE_TONE[m.role] ?? ROLE_TONE.member;
            const isMe = m.id === myId;
            return (
              <div
                key={m.id}
                className={cn(
                  "grid grid-cols-[3fr_140px_1fr_60px] items-center hover:bg-secondary/30 transition-colors",
                  i < members.length - 1 ? "border-b border-border/60" : "",
                )}
              >
                <div className="px-5 py-3 flex items-center gap-3 min-w-0">
                  <Avatar email={m.email} />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {m.email.split("@")[0]}{" "}
                      {isMe && <span className="text-foreground/40 text-xs">(you)</span>}
                      {m.is_super_admin && (
                        <span className="ml-2 text-[9px] uppercase tracking-wide-caps font-mono rounded-md bg-copper/15 text-copper-700 px-1.5 py-0.5 ring-1 ring-copper/30">
                          super
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                </div>
                <div className="px-5 py-3">
                  {canManage && !isMe ? (
                    <select
                      value={m.role}
                      onChange={(e) => void updateRole(m.id, e.target.value)}
                      className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium focus:border-copper focus:outline-none"
                      style={{ color: tone.color }}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-wide-caps"
                      style={{ background: tone.bg, color: tone.color, boxShadow: `inset 0 0 0 1px ${tone.ring}` }}
                    >
                      {m.role}
                    </span>
                  )}
                </div>
                <div className="px-5 py-3 text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </div>
                <div className="px-5 py-3 flex justify-end opacity-60 hover:opacity-100">
                  {canRemove && !isMe && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove ${m.email} from the workspace?`)) {
                          void remove(m.id);
                        }
                      }}
                      aria-label="Remove member"
                      className="text-foreground/40 hover:text-destructive"
                    >
                      <IconClose className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!canManage && (
          <p className="text-xs text-muted-foreground">
            Read-only view — your role is <strong>{myRole}</strong>. Ask an admin or owner to invite or change roles.
          </p>
        )}
      </div>
    </div>
  );
}

function Avatar({ email }: { email: string }) {
  // 2-letter initials from local-part
  const local = email.split("@")[0];
  const parts = local.split(/[._-]/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : local.slice(0, 2).toUpperCase();
  // Stable hue from email
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-medium ring-1 ring-border"
      style={{ background: `hsl(${hue} 30% 88%)`, color: `hsl(${hue} 50% 25%)` }}
    >
      {initials}
    </span>
  );
}
