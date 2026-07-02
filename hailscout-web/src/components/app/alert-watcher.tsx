"use client";

import { useEffect, useRef } from "react";
import { useAlerts, type StormAlert } from "@/hooks/useAlerts";
import { playAlarmForAlert } from "@/lib/alarm-sounds";
import { useToast } from "./toast-host";

/**
 * Watches the alerts SWR for new_in_this_fetch > 0 and fires a toast
 * (plus the severity SOUND and a browser Notification if permitted) for
 * each newly-generated alert.
 *
 * Sound policy: one sound per batch — the LOUDEST alert wins — so an
 * outbreak day (20 zone hits in one fetch) goes "SHATTER", not a drum
 * solo. Zone alerts title with the zone name; address alerts keep the
 * address.
 *
 * Mounts once in the app shell. Skips the very first render so we don't
 * show a flood of toasts (or blast a sound) every time the app loads.
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

    // One sound per batch — severity of the biggest stone (wind alerts
    // count as their own sound; hail outranks wind at equal position).
    const loudest: StormAlert | undefined = [...newest].sort(
      (a, b) => b.peak_size_in - a.peak_size_in,
    )[0];
    if (loudest) playAlarmForAlert(loudest);

    newest.forEach((a) => {
      const isZone = (a.kind ?? "address").startsWith("zone");
      const title = isZone
        ? `${a.peak_size_in.toFixed(2)}″ hail — ${a.zone_name || "alarm zone"}`
        : `New hail alert · ${a.peak_size_in.toFixed(2)}″`;
      const body = isZone
        ? "Storm in one of your alarm zones. Tap to see the swath."
        : `${a.address_label || a.address || "Monitored address"}${a.storm_city ? ` · ${a.storm_city}` : ""}`;
      toast.push({
        title,
        body,
        tone: "alert",
        href: "/app/alerts",
        ttl: 10000,
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
