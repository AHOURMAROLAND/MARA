const CACHE_NAME = 'mara-v4';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/static/img/favicon.ico',
  '/static/img/favicon-16x16.png',
  '/static/img/favicon-32x32.png',
  '/static/img/favicon-48x48.png',
  '/static/img/mara-96x96.png',
  '/static/img/mara-192x192.png',
  '/static/img/mara-512x512.png',
  '/static/img/mara-maskable-192x192.png',
  '/static/img/mara-maskable-512x512.png',
  '/static/img/apple-touch-icon.png',
];

// Installation du service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[MARA] Cache opened');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.log('[MARA] Cache error:', err))
  );
  self.skipWaiting();
});

// Activation — purge des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[MARA] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Strategie: Network first, fallback to cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(response => {
          return response || new Response('Offline — Page non cachee', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
          });
        });
      })
  );
});

// ==================== PUSH NOTIFICATIONS ====================
self.addEventListener('push', event => {
  console.log('[MARA] Push received:', event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('[MARA] Push data is not JSON:', event.data.text());
      data = {
        title: 'Nouveau message sur MARA 💌',
        body: event.data.text() || 'Tu as reçu un message anonyme !',
      };
    }
  } else {
    data = {
      title: 'Nouveau message sur MARA 💌',
      body: 'Tu as reçu un message anonyme !',
    };
  }

  const options = {
    body: data.body || 'Tu as reçu un message anonyme !',
    icon: data.icon || '/static/img/mara-192x192.png',
    badge: data.badge || '/static/img/mara-96x96.png',
    image: data.image || null,
    tag: data.tag || 'new-message',
    requireInteraction: true,
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      messageId: data.messageId || null
    }
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Nouveau message sur MARA 💌',
      options
    )
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // If a window is already open, focus it
        for (let client of clientList) {
          if (client.url && client.url.includes(self.location.hostname)) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        // Otherwise open a new window
        clients.openWindow(targetUrl);
      })
  );
});

// Handle push subscription change
self.addEventListener('pushsubscriptionchange', event => {
  console.log('[MARA] Push subscription changed');
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription.options.applicationServerKey
    }).then(subscription => {
      // Notify server of new subscription
      return fetch('/api/push/subscribe/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });
    })
  );
});
