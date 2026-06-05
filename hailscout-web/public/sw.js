/* HailScout service worker — deliberately conservative.
 *
 * It does NOT cache app JS/CSS (that would risk serving stale bundles and
 * breaking the app on deploy). It only:
 *   1. precaches a tiny offline fallback page, served when a navigation fails
 *      with no network, and
 *   2. handles web-push notifications (real-time hail alerts).
 */
const CACHE = "hailscout-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only intercept top-level navigations; everything else hits the network as
  // usual (no stale-asset risk).
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});

/* ── Web push (real-time hail alerts) ───────────────────────────────────── */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = {};
  }
  const title = data.title || "HailScout alert";
  const options = {
    body: data.body || "New hail activity on a monitored address.",
    icon: "/app-icon/192",
    badge: "/app-icon/192",
    tag: data.tag || "hailscout-alert",
    data: { url: data.url || "/app/alerts" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app/alerts";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(url) && "focus" in w) return w.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
