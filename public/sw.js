const CACHE_NAME = 'tdp-app-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo-tdp.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Bỏ qua các API Supabase để không gây nhiễu
  if (url.includes('/rest/v1/') || url.includes('/auth/v1/')) {
    return;
  }

  // Xử lý điều hướng trang (Navigation / HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const resClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedRes) => {
            return cachedRes || caches.match('/index.html') || caches.match('/');
          });
        })
    );
    return;
  }

  // Các tài nguyên khác (JS, CSS, Font, Ảnh)
  event.respondWith(
    caches.match(event.request).then((cachedRes) => {
      const fetchPromise = fetch(event.request).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return networkRes;
      }).catch(() => cachedRes);

      return cachedRes || fetchPromise;
    })
  );
});
