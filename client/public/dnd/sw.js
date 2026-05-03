/**
 * sw.js — Service Worker (Unterordner /dnd/)
 * Cache-First Strategie für vollständige Offline-Nutzung.
 */

const CACHE_NAME = 'dnd5e-v1';
const BASE = '/dnd';

const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/manifest.json`,
  `${BASE}/css/main.css`,
  `${BASE}/js/data.js`,
  `${BASE}/js/character.js`,
  `${BASE}/js/classes.js`,
  `${BASE}/js/spells.js`,
  `${BASE}/js/items.js`,
  `${BASE}/js/dice.js`,
  `${BASE}/js/app.js`,
  `${BASE}/data/classes.json`,
  `${BASE}/data/spells.json`,
  `${BASE}/data/items.json`,
  `${BASE}/data/races.json`,
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;800&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // API-Anfragen: Network-First
  if (event.request.url.includes('dnd5eapi.co')) {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Alle anderen: Cache-First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        if (!resp || resp.status !== 200 || resp.type === 'opaque') return resp;
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return resp;
      });
    })
  );
});
