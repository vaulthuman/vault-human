// Vault Human service worker: offline fallback and push reminders.
// Member pages are never cached: they are private and change daily.
const CACHE = 'vh-shell-v1';
const SHELL = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }
  if (SHELL.includes(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'Vault Human';
  let url = '/today';
  try {
    const r = new URL(String(data.url || '/today'), self.location.origin);
    if (r.origin === self.location.origin) url = r.pathname + r.search;
  } catch {}
  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Your key is ready.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'vh-key',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const path = (e.notification.data && e.notification.data.url) || '/today';
  const resolved = new URL(path, self.location.origin);
  const target = resolved.origin === self.location.origin ? resolved.href : self.location.origin + '/today';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) if (w.url.startsWith(self.location.origin)) { w.navigate(target); return w.focus(); }
      return self.clients.openWindow(target);
    }),
  );
});
