"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import { timeAgo } from "@/lib/time-ago";
import { useMe } from "@/hooks/useMe";

interface NoteRow {
  id: number;
  user_id: string;
  user_email: string | null;
  body: string;
  created_at: string;
}

interface Props {
  markerId: string;
}

export function MarkerNotesThread({ markerId }: Props) {
  const { getToken, isSignedIn } = useAuth();
  const { me } = useMe();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    try {
      const t = await getToken();
      const rows = await apiClient.get<NoteRow[]>(
        `/v1/markers/${markerId}/notes`,
        t || undefined,
      );
      setNotes(rows);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn, markerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!draft.trim() || !isSignedIn) return;
    setBusy(true);
    try {
      const t = await getToken();
      const created = await apiClient.post<NoteRow>(
        `/v1/markers/${markerId}/notes`,
        { body: draft.trim() },
        t || undefined,
      );
      setNotes((prev) => [...prev, created]);
      setDraft("");
    } finally {
      setBusy(false);
    }
  };

  if (!isSignedIn) {
    return (
      <p className="text-xs text-muted-foreground">
        Sign in to add notes to this marker.
      </p>
    );
  }

  const myEmail = me?.user?.email;

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
        Thread {notes.length > 0 && <span className="text-foreground/55">· {notes.length}</span>}
      </p>

      {loading && (
        <p className="text-xs text-muted-foreground">Loading notes…</p>
      )}

      {!loading && notes.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No notes yet. Add the first one below.
        </p>
      )}

      {notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((n) => {
            const isMine = n.user_email === myEmail;
            return (
              <li key={n.id} className="rounded-md border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-medium text-foreground/85 truncate">
                    {(n.user_email ?? "user").split("@")[0]}{isMine && <span className="text-foreground/45"> · you</span>}
                  </span>
                  <span className="text-[10px] font-mono-num text-foreground/45">
                    {timeAgo(n.created_at)}
                  </span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{n.body}</p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Spoke with the homeowner — they're going to file…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-copper focus:outline-none resize-none"
          disabled={busy}
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !draft.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-teal-900 disabled:opacity-60"
          >
            {busy ? "Posting…" : "Post note"}
          </button>
        </div>
      </div>
    </div>
  );
}
