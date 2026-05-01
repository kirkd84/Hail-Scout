"use client";

/**
 * /app/calendar — follow-up reminders calendar.
 *
 * Aggregates `follow_up_at` from CRM contacts and renders three stacked groups:
 *   • Overdue   (red rule, copper accent)
 *   • This week (default emphasis)
 *   • Upcoming  (the next 30 days)
 *
 * Each row is click-to-resolve: snooze 1 week, or mark "done" (clears the
 * follow-up). The contact card links back to the linked monitored address
 * via /app/customers.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useContacts, type CrmContact } from "@/hooks/useContacts";
import { useSavedAddresses } from "@/hooks/useSavedAddresses";
import { EmptyState } from "@/components/app/empty-state";
import {
  IconCalendar,
  IconPhone,
  IconMail,
  IconChevronRight,
} from "@/components/icons";
import { cn } from "@/lib/utils";

type Bucket = "overdue" | "this_week" | "upcoming" | "later";

interface ScheduledItem {
  contact: CrmContact;
  date: Date;
  daysOut: number; // negative if past
  bucket: Bucket;
  addressLabel?: string;
}

const DAY = 24 * 60 * 60 * 1000;

function classify(date: Date): { bucket: Bucket; daysOut: number } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - now.getTime()) / DAY);
  if (days < 0) return { bucket: "overdue", daysOut: days };
  if (days <= 7) return { bucket: "this_week", daysOut: days };
  if (days <= 30) return { bucket: "upcoming", daysOut: days };
  return { bucket: "later", daysOut: days };
}

export default function CalendarPage() {
  const { contacts, isLoading, update } = useContacts({});
  const { addresses } = useSavedAddresses();
  const [showLater, setShowLater] = useState(false);

  const addrById = useMemo(() => {
    const m = new Map<number, string>();
    addresses.forEach((a) => {
      const aid = Number(a.id);
      if (!Number.isNaN(aid)) m.set(aid, a.label || a.address);
    });
    return m;
  }, [addresses]);

  const scheduled = useMemo<ScheduledItem[]>(() => {
    return contacts
      .filter((c) => !!c.follow_up_at && c.status !== "lost")
      .map((c) => {
        const d = new Date(c.follow_up_at as string);
        const { bucket, daysOut } = classify(d);
        return {
          contact: c,
          date: d,
          daysOut,
          bucket,
          addressLabel: c.monitored_address_id
            ? addrById.get(c.monitored_address_id)
            : undefined,
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [contacts, addrById]);

  const overdue = scheduled.filter((s) => s.bucket === "overdue");
  const thisWeek = scheduled.filter((s) => s.bucket === "this_week");
  const upcoming = scheduled.filter((s) => s.bucket === "upcoming");
  const later = scheduled.filter((s) => s.bucket === "later");

  async function snooze(c: CrmContact, days: number) {
    const base = c.follow_up_at ? new Date(c.follow_up_at) : new Date();
    base.setDate(base.getDate() + days);
    await update(c.id, { follow_up_at: base.toISOString() });
  }

  async function clearFollowUp(c: CrmContact) {
    await update(c.id, { follow_up_at: null });
  }

  if (!isLoading && scheduled.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="container max-w-3xl py-10">
          <EmptyState
            icon={IconCalendar}
            eyebrow="Follow-ups"
            title="Nothing on the calendar."
            description="Set a follow-up date on any contact and it will land here, sorted by urgency. The atlas will tell you who to call back when."
            primary={{ label: "Open contacts", href: "/app/customers" }}
            secondary={{ label: "Open addresses", href: "/app/addresses" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-4xl py-10 space-y-8">
        <div>
          <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
            Field schedule
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
            Follow-ups
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {scheduled.length} contact{scheduled.length === 1 ? "" : "s"} on
            your follow-up calendar.
            {overdue.length > 0 && (
              <span className="text-copper font-medium ml-1">
                {overdue.length} overdue.
              </span>
            )}
          </p>
        </div>

        <div className="rule-atlas" />

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Overdue" value={overdue.length.toString()} accent={overdue.length > 0} />
          <Stat label="This week" value={thisWeek.length.toString()} />
          <Stat label="Next 30 days" value={upcoming.length.toString()} />
        </div>

        {isLoading ? (
          <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          <div className="space-y-8">
            {overdue.length > 0 && (
              <Group
                title="Overdue"
                eyebrow="Past due"
                tone="overdue"
                items={overdue}
                onSnooze={snooze}
                onDone={clearFollowUp}
              />
            )}
            {thisWeek.length > 0 && (
              <Group
                title="This week"
                eyebrow="Next 7 days"
                tone="this_week"
                items={thisWeek}
                onSnooze={snooze}
                onDone={clearFollowUp}
              />
            )}
            {upcoming.length > 0 && (
              <Group
                title="Upcoming"
                eyebrow="Within 30 days"
                tone="upcoming"
                items={upcoming}
                onSnooze={snooze}
                onDone={clearFollowUp}
              />
            )}
            {later.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowLater((v) => !v)}
                  className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-copper"
                >
                  {showLater ? "Hide" : "Show"} {later.length} further out →
                </button>
                {showLater && (
                  <div className="mt-3">
                    <Group
                      title="Later"
                      eyebrow="More than 30 days"
                      tone="upcoming"
                      items={later}
                      onSnooze={snooze}
                      onDone={clearFollowUp}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Group({
  title,
  eyebrow,
  tone,
  items,
  onSnooze,
  onDone,
}: {
  title: string;
  eyebrow: string;
  tone: Bucket;
  items: ScheduledItem[];
  onSnooze: (c: CrmContact, days: number) => Promise<void>;
  onDone: (c: CrmContact) => Promise<void>;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <p
            className={cn(
              "font-mono-num text-[11px] uppercase tracking-wide-caps",
              tone === "overdue" ? "text-copper" : "text-foreground/55",
            )}
          >
            {eyebrow}
          </p>
          <h2 className="font-display text-2xl tracking-tight-display text-foreground">
            {title}
          </h2>
        </div>
        <span className="text-sm text-foreground/55">
          {items.length} contact{items.length === 1 ? "" : "s"}
        </span>
      </div>
      <div
        className={cn(
          "rounded-xl border bg-card overflow-hidden",
          tone === "overdue" ? "border-copper/40" : "border-border",
        )}
      >
        {items.map((it, i) => (
          <ScheduleRow
            key={it.contact.id}
            item={it}
            isLast={i === items.length - 1}
            onSnooze={onSnooze}
            onDone={onDone}
            tone={tone}
          />
        ))}
      </div>
    </section>
  );
}

function ScheduleRow({
  item,
  isLast,
  onSnooze,
  onDone,
  tone,
}: {
  item: ScheduledItem;
  isLast: boolean;
  onSnooze: (c: CrmContact, days: number) => Promise<void>;
  onDone: (c: CrmContact) => Promise<void>;
  tone: Bucket;
}) {
  const { contact, date, daysOut, addressLabel } = item;

  const dateLabel = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  let when: string;
  if (daysOut < 0)
    when = `${Math.abs(daysOut)} day${Math.abs(daysOut) === 1 ? "" : "s"} ago`;
  else if (daysOut === 0) when = "Today";
  else if (daysOut === 1) when = "Tomorrow";
  else when = `In ${daysOut} days`;

  return (
    <div
      className={cn(
        "px-5 py-4 grid grid-cols-[120px_1fr_auto] gap-4 items-center hover:bg-secondary/30 transition-colors",
        !isLast && "border-b border-border/60",
      )}
    >
      <div>
        <div
          className={cn(
            "font-mono-num text-sm font-medium",
            tone === "overdue" ? "text-copper" : "text-foreground",
          )}
        >
          {dateLabel}
        </div>
        <div
          className={cn(
            "text-[11px] font-mono uppercase tracking-wide-caps mt-0.5",
            tone === "overdue" ? "text-copper" : "text-foreground/55",
          )}
        >
          {when}
        </div>
      </div>
      <div className="min-w-0">
        <p className="font-medium text-foreground truncate">{contact.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-foreground/65">
          {contact.phone && (
            <span className="inline-flex items-center gap-1 font-mono-num">
              <IconPhone className="h-3 w-3" />
              {contact.phone}
            </span>
          )}
          {contact.email && (
            <span className="inline-flex items-center gap-1 truncate max-w-[14rem]">
              <IconMail className="h-3 w-3" />
              <span className="truncate">{contact.email}</span>
            </span>
          )}
          {addressLabel && (
            <span className="inline-flex items-center gap-1 text-foreground/55 truncate max-w-[18rem]">
              <span className="truncate">{addressLabel}</span>
            </span>
          )}
        </div>
        {contact.notes && (
          <p className="mt-1 text-[11px] text-foreground/55 line-clamp-1">
            {contact.notes}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSnooze(contact, 7)}
          className="rounded-md border border-border bg-secondary/40 px-2.5 py-1 text-[11px] font-medium text-foreground/65 hover:border-copper/50 hover:text-foreground"
        >
          +1 week
        </button>
        <button
          type="button"
          onClick={() => onDone(contact)}
          className="rounded-md bg-forest/10 border border-forest/30 px-2.5 py-1 text-[11px] font-medium text-forest hover:bg-forest/15"
        >
          Done
        </button>
        <Link
          href="/app/customers"
          className="text-foreground/40 hover:text-copper p-1"
          aria-label="Open contact"
        >
          <IconChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-display text-3xl font-medium tracking-tight-display",
          accent ? "text-copper" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
