// Offline cache. Bump VERSION whenever any file in ASSETS changes so clients pick up the update.
const VERSION = 'pitch-v11';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/pitch.js',
  'js/staircase.js',
  'js/trial.js',
  'js/synth.js',
  'js/store.js',
  'js/stats.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache-first: the app is fully static, and must work with no network.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)),
  );
});
