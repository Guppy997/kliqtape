/* global self */
/* Wochen-Erinnerung (Web-Push). Wird vom generierten Service Worker per
 * importScripts geladen (vite.config.ts). Zeigt den einen Satz an, den der
 * Server schickt, und oeffnet beim Antippen die App. */
self.addEventListener('push', (event) => {
  let data = { title: 'Kliqtape', body: '', url: '/' };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    /* ohne lesbaren Inhalt bleibt es beim Standardtext */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, { body: data.body, icon: '/favicon.svg', data: { url: data.url } }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => 'focus' in c);
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});
