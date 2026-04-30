"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { IconClose, IconBolt } from "@/components/icons";

interface Toast {
  id: string;
  title: string;
  body?: string;
  href?: string;
  tone?: "alert" | "info";
  ttl?: number;
}

interface ToastApi {
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    return { push: () => {}, dismiss: () => {} };
  }
  return ctx;
}

/**
 * Lightweight toast host. Toasts stack top-right with the glass aesthetic.
 * Auto-dismiss after 5s by default. Click to follow the linked href.
 */
export function ToastHost({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const tm = timersRef.current.get(id);
    if (tm) {
      clearTimeout(tm);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback<ToastApi["push"]>((t) => {
    const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, ...t }]);
    const ttl = t.ttl ?? 5000;
    const tm = setTimeout(() => dismiss(id), ttl);
    timersRef.current.set(id, tm);
  }, [dismiss]);

  useEffect(() => () => {
    timersRef.current.forEach((tm) => clearTimeout(tm));
    timersRef.current.clear();
  }, []);

  return (
    <ToastCtx.Provider value={{ push, dismiss }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto sm:top-20 sm:max-w-sm">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const tone = toast.tone ?? "info";
  const inner = (
    <div
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-lg border bg-card px-4 py-3 shadow-panel backdrop-blur",
        "animate-in slide-in-from-right-2 fade-in duration-300",
        tone === "alert" ? "border-copper/50" : "border-border",
      )}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          tone === "alert" ? "bg-copper/15 text-copper" : "bg-foreground/10 text-foreground/70",
        )}
      >
        <IconBolt className="h-3.5 w-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{toast.title}</p>
        {toast.body && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{toast.body}</p>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDismiss();
        }}
        className="text-foreground/40 hover:text-foreground"
        aria-label="Dismiss"
      >
        <IconClose className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  if (toast.href) {
    return (
      <Link
        href={toast.href}
        onClick={onDismiss}
        className="pointer-events-auto block w-full"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
