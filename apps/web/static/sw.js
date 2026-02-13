/**
 * Guilloché Studio Service Worker
 * Handles offline support, caching, and background sync
 */

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `guilloche-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `guilloche-dynamic-${CACHE_VERSION}`;
const WASM_CACHE = `guilloche-wasm-${CACHE_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/studio',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/badge.png',
];

// WASM files to cache (will be cached on first use if not available at install)
const WASM_ASSETS = [
  '/wasm/guilloche_wasm.js',
  '/wasm/guilloche_wasm_bg.wasm',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        // Cache each asset individually to avoid failing the entire cache operation
        return Promise.allSettled(
          STATIC_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`Failed to cache ${url}:`, err);
            })
          )
        );
      }),
      caches.open(WASM_CACHE).then((cache) => {
        // WASM assets are optional at install time - they'll be cached on first use
        return Promise.allSettled(
          WASM_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`Failed to cache WASM ${url}:`, err);
            })
          )
        );
      }),
    ]).then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => {
            return (
              key.startsWith('guilloche-') &&
              key !== STATIC_CACHE &&
              key !== DYNAMIC_CACHE &&
              key !== WASM_CACHE
            );
          })
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip API requests (except health check)
  if (url.pathname.startsWith('/api') && !url.pathname.includes('/health')) {
    return;
  }

  // Skip auth routes
  if (url.pathname.startsWith('/auth')) {
    return;
  }

  // WASM files - cache first
  if (url.pathname.includes('.wasm') || url.pathname.includes('guilloche_wasm')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(WASM_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Static assets - cache first, network fallback
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/) ||
    url.pathname === '/' ||
    url.pathname === '/studio'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        });

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Other requests - network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
          const offlinePage = await caches.match('/offline.html');
          if (offlinePage) {
            return offlinePage;
          }
          // Fallback if offline.html is not cached
          return new Response(
            '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>You are offline</h1><p>Please check your connection and try again.</p></body></html>',
            {
              status: 503,
              headers: { 'Content-Type': 'text/html' },
            }
          );
        }
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      })
  );
});

// Background sync for saving patterns
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-patterns') {
    event.waitUntil(syncPatterns());
  }
});

async function syncPatterns() {
  try {
    // Get pending patterns from IndexedDB
    const db = await openDB();
    const pending = await getPendingPatterns(db);

    for (const pattern of pending) {
      try {
        const response = await fetch('/api/patterns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pattern),
        });

        if (response.ok) {
          await removePendingPattern(db, pattern.id);
        }
      } catch (err) {
        console.error('Failed to sync pattern:', err);
      }
    }
  } catch (err) {
    console.error('Sync failed:', err);
  }
}

// IndexedDB helpers
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('guilloche-offline', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-patterns')) {
        db.createObjectStore('pending-patterns', { keyPath: 'id' });
      }
    };
  });
}

function getPendingPatterns(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending-patterns', 'readonly');
    const store = tx.objectStore('pending-patterns');
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function removePendingPattern(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending-patterns', 'readwrite');
    const store = tx.objectStore('pending-patterns');
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Push notifications (for collaboration updates)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const options = {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge.png',
      tag: data.tag || 'guilloche-notification',
      data: data.url ? { url: data.url } : undefined,
      actions: data.actions || [],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Guilloché Studio', options)
    );
  } catch (err) {
    console.error('Push notification error:', err);
  }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Message handling
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CACHE_PATTERN') {
    const { url, data } = event.data;
    caches.open(DYNAMIC_CACHE).then((cache) => {
      cache.put(url, new Response(JSON.stringify(data)));
    });
  }
});
