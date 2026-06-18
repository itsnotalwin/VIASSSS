const DB_NAME = 'VIAS_ShareTarget';
const STORE_NAME = 'shared_items';
const CACHE_NAME = 'vias-v8';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/logo.png',
  '/manifest.json'
];

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME, { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSharedItem(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readwrite');
    const store = txn.objectStore(STORE_NAME);
    store.add(item);
    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 1. Handle Share Target (POST)
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const title = formData.get('title');
        const text = formData.get('text');
        const shareUrl = formData.get('url');
        const files = formData.getAll('images');
        
        await saveSharedItem({
          title: title || '',
          text: text || '',
          url: shareUrl || '',
          files: files && files.length ? files : [],
          timestamp: Date.now()
        });
      } catch (err) {
        console.error('Share Target Error:', err);
      }
      const targetUrl = new URL('./?shared=1', self.registration.scope).toString();
      return Response.redirect(targetUrl, 303);
    })());
    return;
  }

  // 2. Network-First for Navigation, Cache-First for static assets
  if (event.request.method === 'GET') {
    if (event.request.mode === 'navigate') {
      event.respondWith(
        fetch(event.request)
          .then((networkResponse) => {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          })
          .catch(() => {
            return caches.match(event.request).then((response) => response || caches.match('/'));
          })
      );
      return;
    }

    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) return response;
        
        return fetch(event.request).then((networkResponse) => {
          // Cache fonts and common static assets on the fly
          const isFont = url.origin === 'https://fonts.gstatic.com' || url.origin === 'https://fonts.googleapis.com';
          const isStaticAsset = url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2)$/);
          
          if (networkResponse.ok && (isFont || isStaticAsset) && !url.pathname.includes('/api/')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          
          return networkResponse;
        }).catch(() => {
          // If network fails and it's a navigation request, return index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
    );
  }
});
