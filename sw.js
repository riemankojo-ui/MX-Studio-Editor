const CACHE_NAME = 'mx-studio-v' + Date.now();

const SHELL = [
  './',
  './index.html',
  './manifest2.json',
  './effects.json'
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

// Fetch — cache-first with network fallback
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Skip blob: and data: URLs
  if (req.url.startsWith('blob:') || req.url.startsWith('data:')) return;

  // Cache Google Fonts at runtime
  if (req.url.includes('fonts.googleapis.com') || req.url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(req).then(hit => {
        if (hit) return hit;
        return fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          return res;
        }).catch(() => new Response('', { status: 200 }));
      })
    );
    return;
  }

  // Everything else — cache-first
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (!res || (res.status !== 200 && res.type !== 'opaque')) return res;
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});