/**
 * SAARTHI — Service Worker (item #15: real push notifications)
 * ================================================================
 * Sirf 2 kaam:
 *  1. "push" event aaye toh ek notification dikhao (Amrit-yaad-dilana /
 *     birthday jaisa message, Cloudflare Worker se bheja gaya)
 *  2. Notification par click ho toh app khol do (ya already khuli tab par
 *     focus kar do)
 * Koi caching/offline logic yahan nahi — sirf push ke liye.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "SAARTHI GYAAN", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "SAARTHI GYAAN 🕉️";
  const options = {
    body: data.body || "आज का अमृत पढ़ें और अपने सवाल पूछें 🙏",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: data.tag || "saarthi-reminder",
    renotify: true,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
