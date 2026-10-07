const CACHE_NAME = 'mx-studio-v' + Date.now();

// Files to cache immediately when the service worker installs
const SHELL = [
  './',
  './index.html',
  './manifest2.json',
  './effects.json',
  './sw.js'
];

// Install — cache the shell
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(SHELL).catch(() => {}))
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first with network fallback, and runtime caching for anything new
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Don't try to cache blob: or data: URLs
  if (req.url.startsWith('blob:') || req.url.startsWith('data:')) return;

  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;

      return fetch(req).then(res => {
        // Only cache successful responses (and opaque cross-origin ones)
        if (!res || (res.status !== 200 && res.type !== 'opaque')) return res;

        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => {
        // If offline and not cached → return a fallback for navigations
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});