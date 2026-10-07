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

// Fetch — network-first for HTML/JS/CSS, cache-first for everything else
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Skip blob: and data: URLs
  if (req.url.startsWith('blob:') || req.url.startsWith('data:')) return;

  const url = req.url;
  const isHtml = req.mode === 'navigate' || req.destination === 'document' || url.endsWith('.html');
  const isCode = req.destination === 'script' || req.destination === 'style' || url.endsWith('.js') || url.endsWith('.css');
  const isConfig = url.endsWith('.json');

  // NETWORK-FIRST for the app shell — updates come through as soon as you're online
  if (isHtml || isCode || isConfig) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // CACHE-FIRST for images, fonts, effects
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (!res || (res.status !== 200 && res.type !== 'opaque')) return res;
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => new Response('', { status: 503 }));
    })
  );
});