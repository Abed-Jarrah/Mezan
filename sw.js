const VERSION = '20260621-finance3';
const CACHE = `mezan-v19-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './offline.html',
  `./manifest.webmanifest?v=${VERSION}`,
  './assets/icon.svg',
  `./css/variables.css?v=${VERSION}`,
  `./css/layout.css?v=${VERSION}`,
  `./css/components.css?v=${VERSION}`,
  `./css/responsive.css?v=${VERSION}`,
  `./css/splash.css?v=${VERSION}`,
  `./js/storage.js?v=${VERSION}`,
  `./js/calculations.js?v=${VERSION}`,
  `./js/translations.js?v=${VERSION}`,
  `./js/currency.js?v=${VERSION}`,
  `./js/ui.js?v=${VERSION}`,
  `./js/app.js?v=${VERSION}`,
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
