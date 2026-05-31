// Web Push handlers, imported into the workbox-generated service worker via
// `workbox.importScripts` in vite.config.ts. Kept as a plain static file so we
// don't have to switch the PWA off the generateSW strategy.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Reminder', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Reminder';
  const options = {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if ('focus' in win) {
          win.focus();
          if ('navigate' in win && url !== '/') win.navigate(url).catch(() => {});
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
