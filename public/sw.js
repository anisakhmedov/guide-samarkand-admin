// Minimal service worker: only needed to show system notifications (Android Chrome
// requires one) and to open the right page when a notification is tapped. No caching.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const client = clients.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        client.postMessage({ type: 'navigate', url });
        return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
