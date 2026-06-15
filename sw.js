const CACHE = 'mezan-v5-20260615';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './css/variables.css',
  './css/layout.css',
  './css/components.css',
  './css/responsive.css',
  './js/storage.js',
  './js/calculations.js',
  './js/translations.js',
  './js/currency.js',
  './js/ui.js',
  './js/app.js',
  './assets/fonts/cairo-400.ttf',
  './assets/fonts/cairo-500.ttf',
  './assets/fonts/cairo-600.ttf',
  './assets/fonts/cairo-700.ttf',
  './assets/fonts/cairo-800.ttf'
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
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
