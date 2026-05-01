"use client";

import { useEffect, useRef } from "react";
import { useAlerts } from "@/hooks/useAlerts";
import { useToast } from "./toast-host";

/**
 * Watches the alerts SWR for new_in_this_fetch > 0 and fires a toast
 * (and a browser Notification if the user has granted permission) for
 * each newly-generated alert.
 *
 * Mounts once in the app shell. Skips the very first render so we don't
 * show a flood of toasts every time the app loads.
 */
export function AlertWatcher() {
  const { alerts, newInThisFetch, consumeNewCount } = useAlerts();
  const toast = useToast();
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    if (newInThisFetch <= 0) return;

    const newest = alerts.slice(0, newInThisFetch);
    newest.forEach((a) => {
      const title = `New hail alert · ${a.peak_size_in.toFixed(2)}″`;
      const body = `${a.address_label || a.address || "Monitored address"}${a.storm_city ? ` · ${a.storm_city}` : ""}`;
      toast.push({
        title,
        body,
        tone: "alert",
        href: "/app/alerts",
        ttl: 8000,
      });

      // Browser notification — only if permission was previously granted
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          try {
            new Notification(title, { body, tag: `hs-alert-${a.id}` });
          } catch {
            // ignore — some browsers throw when tab is hidden
          }
        }
      }
    });
    consumeNewCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newInThisFetch]);

  return null;
}
