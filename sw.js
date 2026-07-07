const CACHE_NAME = 'poctagram-v1';
const STATIC_CACHE = 'poctagram-static-v1';
const DYNAMIC_CACHE = 'poctagram-dynamic-v1';

// Cache yapılacak statik kaynaklar
const STATIC_ASSETS = [
  '/',
  '/poctagram-instagram.html',
  '/manifest.json'
];

// Service Worker yükleme ve kurulum
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('Caching static assets');
      // Hata olsa bile devam et
      return Promise.allSettled(
        STATIC_ASSETS.map(url => 
          cache.add(url).catch(err => console.log('Cache miss:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Service Worker aktivasyon
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event handling - Network First strategy for API, Cache First for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // JSONbin API calls - Network first
  if (url.hostname === 'api.jsonbin.io') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone ve cache'e kaydet
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Offline: cache'den döndür
          return caches.match(event.request).then((response) => {
            return response || new Response(
              JSON.stringify({ error: 'offline', record: {} }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Same-origin requests - Cache first for static, Network first for HTML
  if (url.origin === location.origin) {
    // HTML - Network first
    if (event.request.url.includes('.html') || event.request.url === location.origin + '/') {
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(event.request, responseClone);
            });
            return response;
          })
          .catch(() => {
            return caches.match(event.request).then((response) => {
              return response || new Response('Offline - cached version unavailable', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
          })
      );
      return;
    }

    // CSS, JS, images - Cache first
    if (event.request.url.includes('.css') || 
        event.request.url.includes('.js') || 
        event.request.url.match(/\.(png|jpg|jpeg|svg|gif|webp)$/)) {
      event.respondWith(
        caches.match(event.request).then((response) => {
          if (response) return response;
          return fetch(event.request).then((response) => {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(event.request, responseClone);
            });
            return response;
          }).catch(() => {
            // Fallback 1x1 transparent image for failed images
            if (event.request.destination === 'image') {
              return new Response(
                new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x08, 0x5B, 0x63, 0xF8, 0x0F, 0x00, 0x00, 0x01, 0x01, 0x01, 0x00, 0x1B, 0xB6, 0xEE, 0x56, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]),
                { headers: { 'Content-Type': 'image/png' } }
              );
            }
            return new Response('Offline', { status: 503 });
          });
        })
      );
      return;
    }
  }

  // Diğer tüm requestler
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((response) => {
          return response || new Response('Offline', { status: 503 });
        });
      })
  );
});

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Poçtagram bildirimi',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="32" fill="%23075E54"/><path d="M32 10C20.95 10 12 18.95 12 30C12 33.8 13.08 37.34 14.95 40.34L12 52L23.95 49.12C26.82 50.67 30.3 51.6 34 51.6C45.05 51.6 54 42.65 54 31.6C54 20.55 45.05 10 32 10Z" fill="%2325D366"/></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="%23075E54"/></svg>',
    tag: data.tag || 'poctagram-notification',
    requireInteraction: data.requireInteraction || false,
    actions: [
      { action: 'open', title: 'Aç' },
      { action: 'close', title: 'Kapat' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Poçtagram', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Eğer pencere açıksa fokus et
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Yoksa yeni pencere aç
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Background sync handling
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  try {
    // LocalStorage'dan gönderilmeyi bekleyen mesajları al
    const pending = JSON.parse(localStorage.getItem('ptg_pending_messages') || '[]');
    
    if (pending.length === 0) {
      return;
    }

    // Her mesaj için API'yi çağır
    for (const msg of pending) {
      try {
        const response = await fetch('https://api.jsonbin.io/v3/b/msgs', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': '$2a$10$JGOBHlKcxZkUbNs5cdk94.hBGlx6vtDMYI5uf0iAzSWlqSlS.J8UW'
          },
          body: JSON.stringify(msg)
        });

        if (response.ok) {
          // Başarılıysa listeden kaldır
          pending.splice(pending.indexOf(msg), 1);
        }
      } catch (error) {
        console.log('Sync error:', error);
      }
    }

    // Güncellenmiş listeyi kaydet
    localStorage.setItem('ptg_pending_messages', JSON.stringify(pending));
  } catch (error) {
    console.log('Background sync error:', error);
  }
}

// Message handling from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
