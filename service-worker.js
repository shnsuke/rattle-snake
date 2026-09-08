const CACHE_NAME = 'rattlesnake-v7';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/workout.js',
  './js/progression.js',
  './js/chart.js',
  './js/player.js',
  './js/storage.js',
  './js/csvimport.js',
  './js/suggest.js',
  './js/export.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './data/rattlesnake_original_ride.csv',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
