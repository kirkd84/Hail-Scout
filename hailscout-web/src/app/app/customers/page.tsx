"use client";

/**
 * /app/customers — flat list of all CRM contacts across all addresses.
 * Filterable by status. Click a contact to expand and edit inline.
 */

import { useMemo, useState } from "react";

import { useContacts, type ContactStatus, type CrmContact } from "@/hooks/useContacts";
import { useSavedAddresses } from "@/hooks/useSavedAddresses";

import { EmptyState } from "@/components/app/empty-state";
import { IconUsers, IconPhone, IconMail, IconCalendar } from "@/components/icons";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: Array<{ value: ContactStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "prospect", label: "Prospects" },
  { value: "customer", label: "Customers" },
  { value: "lost", label: "Lost" },
];

const STATUS_TONE: Record<ContactStatus, { bg: string; fg: string; border: string }> = {
  prospect: { bg: "bg-copper/10", fg: "text-copper", border: "border-copper/30" },
  customer: { bg: "bg-forest/10", fg: "text-forest", border: "border-forest/30" },
  lost: { bg: "bg-foreground/5", fg: "text-foreground/55", border: "border-border" },
};

const STATUS_LABEL: Record<ContactStatus, string> = {
  prospect: "Prospect",
  customer: "Customer",
  lost: "Lost",
};

export default function CustomersPage() {
  const [filter, setFilter] = useState<ContactStatus | "all">("all");
  const { contacts, isLoading, update, remove } = useContacts({
    status: filter === "all" ? null : filter,
  });
  const { addresses } = useSavedAddresses();
  const [openId, setOpenId] = useState<string | null>(null);

  const addrById = useMemo(() => {
    const m = new Map<number, string>();
    addresses.forEach((a) => {
      const aid = Number(a.id);
      if (!Number.isNaN(aid)) m.set(aid, a.label || a.address);
    });
    return m;
  }, [addresses]);

  // Counts (always show full count regardless of filter — for the chips)
  const allContacts = contacts; // already filtered by hook

  if (!isLoading && contacts.length === 0 && filter === "all") {
    return (
      <div className="h-full overflow-y-auto">
        <div className="container max-w-3xl py-10">
          <EmptyState
            icon={IconUsers}
            eyebrow="CRM"
            title="No contacts yet."
            description="Save addresses to your watchlist, then add the homeowner's contact info as you knock doors. Every contact stays attached to its address so you never lose context on the next storm."
            primary={{ label: "Open monitored addresses", href: "/app/addresses" }}
            secondary={{ label: "Search the atlas", href: "/app/map" }}
          />
        </div>
      </div>
    );
  }

  // Group by status for KPI bar
  const byStatus = (s: ContactStatus) => contacts.filter((c) => c.status === s).length;
  const followUpsThisWeek = contacts.filter((c) => {
    if (!c.follow_up_at) return false;
    const t = new Date(c.follow_up_at).getTime();
    const now = Date.now();
    return t >= now && t <= now + 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-5xl py-10 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
              Customer ledger
            </p>
            <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
              Contacts
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every prospect, customer, and homeowner attached to your watchlist.
            </p>
          </div>
        </div>

        <div className="rule-atlas" />

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Prospects" value={byStatus("prospect").toString()} accent />
          <Stat label="Customers" value={byStatus("customer").toString()} />
          <Stat label="Lost" value={byStatus("lost").toString()} dim />
          <Stat label="Follow-ups this week" value={followUpsThisWeek.toString()} accent />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                filter === f.value
                  ? "border-copper bg-copper text-white"
                  : "border-border bg-card text-foreground/70 hover:border-copper/50",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading contacts…
          </div>
        ) : contacts.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-secondary/20 p-10 text-center">
            <p className="text-sm text-foreground/65">
              No contacts match this filter.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {allContacts.map((c, i) => (
              <ContactListRow
                key={c.id}
                contact={c}
                addressLabel={c.monitored_address_id ? addrById.get(c.monitored_address_id) : undefined}
                isLast={i === allContacts.length - 1}
                expanded={openId === c.id}
                onToggle={() => setOpenId(openId === c.id ? null : c.id)}
                onSave={(patch) => update(c.id, patch)}
                onDelete={async () => {
                  await remove(c.id);
                  setOpenId(null);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContactListRow({
  contact,
  addressLabel,
  isLast,
  expanded,
  onToggle,
  onSave,
  onDelete,
}: {
  contact: CrmContact;
  addressLabel?: string;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSave: (patch: Partial<CrmContact>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const tone = STATUS_TONE[contact.status];
  const followUpDate = contact.follow_up_at ? new Date(contact.follow_up_at) : null;
  const followUpSoon =
    followUpDate &&
    followUpDate.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 &&
    followUpDate.getTime() > Date.now();

  return (
    <div className={cn(!isLast && !expanded ? "border-b border-border/60" : "")}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full text-left px-5 py-4 hover:bg-secondary/30 transition-colors",
          expanded && "bg-secondary/30",
        )}
      >
        <div className="grid grid-cols-[1.5fr_1.2fr_1fr_140px] gap-4 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-foreground truncate">{contact.name}</p>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide-caps",
                  tone.bg,
                  tone.fg,
                  tone.border,
                )}
              >
                {STATUS_LABEL[contact.status]}
              </span>
            </div>
            {addressLabel && (
              <p className="mt-1 text-xs text-foreground/55 truncate">
                {addressLabel}
              </p>
            )}
          </div>
          <div className="text-xs text-foreground/65">
            {contact.phone && (
              <div className="inline-flex items-center gap-1 font-mono-num">
                <IconPhone className="h-3 w-3" />
                {contact.phone}
              </div>
            )}
            {contact.email && (
              <div className="mt-0.5 inline-flex items-center gap-1 truncate">
                <IconMail className="h-3 w-3" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
            {!contact.phone && !contact.email && (
              <span className="text-foreground/40">—</span>
            )}
          </div>
          <div className="text-xs">
            {followUpDate ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  followUpSoon ? "text-copper font-medium" : "text-foreground/65",
                )}
              >
                <IconCalendar className="h-3 w-3" />
                {followUpDate.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            ) : (
              <span className="text-foreground/40">No follow-up</span>
            )}
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
              {expanded ? "Close" : "Edit"}
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-b border-border bg-secondary/10 px-5 py-4">
          <ExpandedEditor
            contact={contact}
            addressLabel={addressLabel}
            onSave={onSave}
            onDelete={onDelete}
            onClose={onToggle}
          />
        </div>
      )}
    </div>
  );
}

function ExpandedEditor({
  contact,
  addressLabel,
  onSave,
  onDelete,
  onClose,
}: {
  contact: CrmContact;
  addressLabel?: string;
  onSave: (patch: Partial<CrmContact>) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [status, setStatus] = useState<ContactStatus>(contact.status);
  const [notes, setNotes] = useState(contact.notes ?? "");
  const [followUp, setFollowUp] = useState(
    contact.follow_up_at ? contact.follow_up_at.slice(0, 10) : "",
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        status,
        notes: notes.trim() || null,
        follow_up_at: followUp ? new Date(followUp + "T00:00:00").toISOString() : null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {addressLabel && (
        <div className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55">
          Linked to: {addressLabel}
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        <FieldStacked label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-card border border-border focus:border-copper rounded-md text-sm py-1.5 px-2 outline-none"
          />
        </FieldStacked>
        <FieldStacked label="Phone">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-card border border-border focus:border-copper rounded-md text-sm py-1.5 px-2 outline-none font-mono-num"
          />
        </FieldStacked>
        <FieldStacked label="Email">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="w-full bg-card border border-border focus:border-copper rounded-md text-sm py-1.5 px-2 outline-none"
          />
        </FieldStacked>
        <FieldStacked label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ContactStatus)}
            className="w-full bg-card border border-border focus:border-copper rounded-md text-sm py-1.5 px-2 outline-none"
          >
            <option value="prospect">Prospect</option>
            <option value="customer">Customer</option>
            <option value="lost">Lost</option>
          </select>
        </FieldStacked>
        <FieldStacked label="Follow up">
          <input
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            className="w-full bg-card border border-border focus:border-copper rounded-md text-sm py-1.5 px-2 outline-none font-mono-num"
          />
        </FieldStacked>
        <FieldStacked label="Created">
          <span className="text-xs text-foreground/55 py-2 inline-block">
            {new Date(contact.created_at).toLocaleDateString()}
          </span>
        </FieldStacked>
      </div>
      <FieldStacked label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full bg-card border border-border focus:border-copper rounded-md text-sm p-2 outline-none resize-y"
        />
      </FieldStacked>
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={async () => {
            if (confirm(`Delete ${contact.name}?`)) await onDelete();
          }}
          className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/40 hover:text-destructive"
        >
          Delete contact
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-foreground/65 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={handleSave}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-teal-900 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldStacked({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55 mb-1 block">
        {label}
      </span>
      {children}
    </label>
  );
}

function Stat({
  label,
  value,
  accent,
  dim,
}: {
  label: string;
  value: string;
  accent?: boolean;
  dim?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-display text-3xl font-medium tracking-tight-display",
          accent ? "text-copper" : dim ? "text-foreground/45" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
