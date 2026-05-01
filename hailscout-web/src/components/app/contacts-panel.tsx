"use client";

/**
 * ContactsPanel — inline contact editor used in two contexts:
 *   1. /app/addresses row expander (addressId set)
 *   2. /app/customers list rows (addressId optional)
 *
 * The pattern: list current contacts, edit inline, "+ Add contact" creates
 * a new draft row that becomes real on save. No modal, no extra navigation —
 * stays close to the address it relates to.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useContacts, type ContactStatus, type CrmContact } from "@/hooks/useContacts";
import {
  IconPhone,
  IconMail,
  IconCalendar,
  IconUser,
  IconPlus,
  IconTrash,
} from "@/components/icons";

const STATUS_LABELS: Record<ContactStatus, string> = {
  prospect: "Prospect",
  customer: "Customer",
  lost: "Lost",
};

const STATUS_TONE: Record<ContactStatus, { bg: string; fg: string; border: string }> = {
  prospect: { bg: "bg-copper/10", fg: "text-copper", border: "border-copper/30" },
  customer: { bg: "bg-forest/10", fg: "text-forest", border: "border-forest/30" },
  lost: { bg: "bg-foreground/5", fg: "text-foreground/55", border: "border-border" },
};

interface Props {
  addressId: number | null;
  /** Optional pretty label shown above the list (e.g. address text). */
  contextLabel?: string | null;
  /** When true, renders without the wrapping panel chrome. */
  embedded?: boolean;
}

export function ContactsPanel({ addressId, contextLabel, embedded = false }: Props) {
  const { contacts, isLoading, create, update, remove } = useContacts({
    addressId,
  });
  const [drafting, setDrafting] = useState(false);

  const wrapper = embedded
    ? "space-y-3"
    : "rounded-xl border border-border bg-card p-5 space-y-4";

  return (
    <div className={wrapper}>
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide-caps text-copper">
              Contacts
            </p>
            <h3 className="mt-0.5 font-display text-lg tracking-tight-display text-foreground">
              {contextLabel || "People at this address"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setDrafting(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-foreground hover:border-copper/50"
          >
            <IconPlus className="h-3.5 w-3.5" />
            Add contact
          </button>
        </div>
      )}

      {embedded && !drafting && contacts.length > 0 && (
        <button
          type="button"
          onClick={() => setDrafting(true)}
          className="text-[11px] font-mono uppercase tracking-wide-caps text-copper hover:text-copper-700"
        >
          + Add another
        </button>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading contacts…</div>
      ) : contacts.length === 0 && !drafting ? (
        <div className="rounded-md border border-dashed border-border bg-secondary/20 p-4 text-center">
          <p className="text-sm text-foreground/65">No contacts yet.</p>
          <button
            type="button"
            onClick={() => setDrafting(true)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-teal-900"
          >
            <IconPlus className="h-3.5 w-3.5" />
            Add the first contact
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {contacts.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              onSave={(patch) => update(c.id, patch)}
              onDelete={() => remove(c.id)}
            />
          ))}
          {drafting && (
            <DraftRow
              addressId={addressId}
              onCancel={() => setDrafting(false)}
              onCreate={async (input) => {
                await create(input);
                setDrafting(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ContactRow({
  contact,
  onSave,
  onDelete,
}: {
  contact: CrmContact;
  onSave: (patch: Partial<CrmContact>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [status, setStatus] = useState<ContactStatus>(contact.status);
  const [notes, setNotes] = useState(contact.notes ?? "");
  const [followUp, setFollowUp] = useState(
    contact.follow_up_at ? contact.follow_up_at.slice(0, 10) : "",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(contact.name);
    setEmail(contact.email ?? "");
    setPhone(contact.phone ?? "");
    setStatus(contact.status);
    setNotes(contact.notes ?? "");
    setFollowUp(contact.follow_up_at ? contact.follow_up_at.slice(0, 10) : "");
  }, [contact]);

  const tone = STATUS_TONE[contact.status];

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
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="rounded-md border border-border bg-card hover:border-copper/40 transition-colors">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full text-left px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
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
                  {STATUS_LABELS[contact.status]}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/65">
                {contact.phone && (
                  <span className="inline-flex items-center gap-1 font-mono-num">
                    <IconPhone className="h-3 w-3" />
                    {contact.phone}
                  </span>
                )}
                {contact.email && (
                  <span className="inline-flex items-center gap-1 truncate max-w-[16rem]">
                    <IconMail className="h-3 w-3" />
                    <span className="truncate">{contact.email}</span>
                  </span>
                )}
                {contact.follow_up_at && (
                  <span className="inline-flex items-center gap-1">
                    <IconCalendar className="h-3 w-3" />
                    Follow up {new Date(contact.follow_up_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              {contact.notes && (
                <p className="mt-2 text-xs text-foreground/55 line-clamp-2">{contact.notes}</p>
              )}
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wide-caps text-copper opacity-0 group-hover:opacity-100">
              Edit
            </span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md border-2 border-copper/40 bg-card p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" icon={<IconUser className="h-3.5 w-3.5" />}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-transparent border-b border-border focus:border-copper text-sm py-1 outline-none"
          />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ContactStatus)}
            className="w-full bg-transparent border-b border-border focus:border-copper text-sm py-1 outline-none"
          >
            <option value="prospect">Prospect</option>
            <option value="customer">Customer</option>
            <option value="lost">Lost</option>
          </select>
        </Field>
        <Field label="Phone" icon={<IconPhone className="h-3.5 w-3.5" />}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-transparent border-b border-border focus:border-copper text-sm py-1 outline-none font-mono-num"
            placeholder="(555) 123-4567"
          />
        </Field>
        <Field label="Email" icon={<IconMail className="h-3.5 w-3.5" />}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="w-full bg-transparent border-b border-border focus:border-copper text-sm py-1 outline-none"
            placeholder="hello@example.com"
          />
        </Field>
        <Field label="Follow up" icon={<IconCalendar className="h-3.5 w-3.5" />}>
          <input
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            className="w-full bg-transparent border-b border-border focus:border-copper text-sm py-1 outline-none font-mono-num"
          />
        </Field>
      </div>
      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full bg-transparent border border-border focus:border-copper rounded-md text-sm p-2 outline-none resize-y"
        />
      </Field>
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={async () => {
            if (confirm(`Delete contact ${contact.name}?`)) await onDelete();
          }}
          className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide-caps text-foreground/40 hover:text-destructive"
        >
          <IconTrash className="h-3.5 w-3.5" />
          Delete
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
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
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DraftRow({
  addressId,
  onCancel,
  onCreate,
}: {
  addressId: number | null;
  onCancel: () => void;
  onCreate: (input: {
    name: string;
    monitored_address_id?: number | null;
    email?: string | null;
    phone?: string | null;
    status: ContactStatus;
    notes?: string | null;
    follow_up_at?: string | null;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<ContactStatus>("prospect");
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        monitored_address_id: addressId,
        email: email.trim() || null,
        phone: phone.trim() || null,
        status,
        notes: notes.trim() || null,
        follow_up_at: followUp ? new Date(followUp + "T00:00:00").toISOString() : null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border-2 border-dashed border-copper/40 bg-secondary/30 p-4 space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-wide-caps text-copper">
        New contact
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" icon={<IconUser className="h-3.5 w-3.5" />}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Jane Homeowner"
            className="w-full bg-transparent border-b border-border focus:border-copper text-sm py-1 outline-none"
          />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ContactStatus)}
            className="w-full bg-transparent border-b border-border focus:border-copper text-sm py-1 outline-none"
          >
            <option value="prospect">Prospect</option>
            <option value="customer">Customer</option>
            <option value="lost">Lost</option>
          </select>
        </Field>
        <Field label="Phone" icon={<IconPhone className="h-3.5 w-3.5" />}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-transparent border-b border-border focus:border-copper text-sm py-1 outline-none font-mono-num"
            placeholder="(555) 123-4567"
          />
        </Field>
        <Field label="Email" icon={<IconMail className="h-3.5 w-3.5" />}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="hello@example.com"
            className="w-full bg-transparent border-b border-border focus:border-copper text-sm py-1 outline-none"
          />
        </Field>
        <Field label="Follow up" icon={<IconCalendar className="h-3.5 w-3.5" />}>
          <input
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            className="w-full bg-transparent border-b border-border focus:border-copper text-sm py-1 outline-none font-mono-num"
          />
        </Field>
      </div>
      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Met at the door — interested in inspection"
          className="w-full bg-transparent border border-border focus:border-copper rounded-md text-sm p-2 outline-none resize-y"
        />
      </Field>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-foreground/65 hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={handleCreate}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-teal-900 disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add contact"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55 mb-1">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
