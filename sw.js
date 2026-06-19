const CACHE = 'mezan-v18-20260621-finance2';
const ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './css/variables.css',
  './css/layout.css',
  './css/components.css',
  './css/responsive.css',
  './css/splash.css',
  './js/storage.js',
  './js/calculations.js',
  './js/translations.js',
  './js/currency.js',
  './js/ui.js',
  './js/app.js',
  './assets/fonts/plex-arabic-400.ttf',
  './assets/fonts/plex-arabic-500.ttf',
  './assets/fonts/plex-arabic-600.ttf',
  './assets/fonts/plex-arabic-700.ttf'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(async () => (await caches.match('./index.html')) || caches.match('./offline.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request)))
  );
});
