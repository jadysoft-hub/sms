// ══════════════════════════════════════════════════════
//  POÇTAGRAM SERVICE WORKER
// ══════════════════════════════════════════════════════
const CACHE_NAME = 'poctagram-cache-v1';

// Uygulamanın çalışması için gereken temel dosyalar (app shell).
// Kendi dosya adlarınla eşleştiğinden emin ol.
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ── KURULUM: app shell'i önbelleğe al ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// ── AKTİVASYON: eski cache'leri temizle ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: API isteklerini (jsonbin) her zaman ağdan çek,
//    statik dosyaları cache-first sun, yoksa ağa düş ──
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // JSONBin veya başka API çağrılarını asla cache'leme — her zaman canlı veri lazım
  if (url.hostname.includes('jsonbin.io') || event.request.method !== 'GET') {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // Statik dosyalar: cache-first, arka planda güncelle
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
