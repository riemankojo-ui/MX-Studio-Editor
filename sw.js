// Simple self-cleaning service worker — no aggressive caching
self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
  );
});

self.addEventListener('fetch', e => {
  // Always network
  e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
});