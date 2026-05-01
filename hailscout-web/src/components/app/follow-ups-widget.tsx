"use client";

/**
 * FollowUpsWidget — small dashboard panel that surfaces overdue / this-week
 * follow-ups. Lives on /app and links into the full /app/calendar page.
 */

import Link from "next/link";
import { useContacts, type CrmContact } from "@/hooks/useContacts";
import { IconCalendar, IconChevronRight } from "@/components/icons";
import { cn } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

function bucketFor(d: Date): "overdue" | "today" | "soon" | "later" {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  const days = Math.round((t.getTime() - now.getTime()) / DAY);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "soon";
  return "later";
}

export function FollowUpsWidget() {
  const { contacts, isLoading } = useContacts({});
  const due = contacts
    .filter((c): c is CrmContact & { follow_up_at: string } => !!c.follow_up_at && c.status !== "lost")
    .map((c) => ({ contact: c, date: new Date(c.follow_up_at) }))
    .filter(({ date }) => {
      const b = bucketFor(date);
      return b === "overdue" || b === "today" || b === "soon";
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6);

  const overdueCount = due.filter(({ date }) => bucketFor(date) === "overdue").length;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide-caps text-copper">
            Field schedule
          </p>
          <h3 className="font-display text-lg tracking-tight-display text-foreground">
            Follow-ups due
          </h3>
        </div>
        <Link
          href="/app/calendar"
          className="text-[11px] font-mono uppercase tracking-wide-caps text-copper hover:text-copper-700"
        >
          Open calendar →
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : due.length === 0 ? (
        <div className="text-center py-6">
          <IconCalendar className="h-8 w-8 mx-auto text-foreground/25" />
          <p className="mt-2 text-sm text-foreground/55">
            Nothing due. The atlas is calm.
          </p>
        </div>
      ) : (
        <>
          {overdueCount > 0 && (
            <p className="text-[11px] font-mono uppercase tracking-wide-caps text-copper mb-2">
              {overdueCount} overdue
            </p>
          )}
          <ul className="divide-y divide-border/50">
            {due.map(({ contact, date }) => {
              const b = bucketFor(date);
              const label =
                b === "overdue"
                  ? `${Math.round((Date.now() - date.getTime()) / DAY)}d ago`
                  : b === "today"
                    ? "Today"
                    : date.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      });
              return (
                <li key={contact.id}>
                  <Link
                    href="/app/calendar"
                    className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-md hover:bg-secondary/30 transition-colors"
                  >
                    <span
                      className={cn(
                        "inline-flex w-20 shrink-0 text-[11px] font-mono-num font-medium",
                        b === "overdue" ? "text-copper" : "text-foreground/70",
                      )}
                    >
                      {label}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate">
                        {contact.name}
                      </span>
                      {contact.phone && (
                        <span className="block text-[11px] font-mono-num text-foreground/55 truncate">
                          {contact.phone}
                        </span>
                      )}
                    </span>
                    <IconChevronRight className="h-4 w-4 text-foreground/30" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
