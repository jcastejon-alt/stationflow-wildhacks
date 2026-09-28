// Foreground-page notifications only. This worker does not subscribe to Push,
// cache API data, or keep polling alive when the ticket page is closed.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = event.notification.data?.url;
  if (typeof path !== 'string' || !path.startsWith('/ticket/')) return;
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const exact = clients.find(client => client.url === target);
    if (exact) return exact.focus();
    return self.clients.openWindow(target);
  }));
});
