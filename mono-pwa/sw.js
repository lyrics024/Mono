/* Service Worker — Cache strategy: cache-first for assets, network-first for app shell */
const CACHE_NAME = 'mono-v5-20260813-5';

const ASSETS = [
  '/',
  '/index.html',
  '/css/variables.css',
  '/css/base.css',
  '/css/animation.css',
  '/css/cabinet.css',
  '/css/item.css',
  '/css/forms.css',
  '/css/search.css',
  '/css/settings.css',
  '/css/crop.css',
  '/css/batch.css',
  '/js/store.js',
  '/js/utils.js',
  '/js/router.js',
  '/js/animation.js',
  '/js/cabinet.js',
  '/js/detail.js',
  '/js/form.js',
  '/js/category.js',
  '/js/search.js',
  '/js/settings.js',
  '/js/notifications.js',
  '/js/crop.js',
  '/js/batch.js',
  '/js/app.js',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});