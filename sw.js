const CACHE_NAME = 'secopticon-v2';
const ASSETS_TO_CACHE = [
  '/',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/data/s1-math.js',
  'js/data/s2-cs.js',
  'js/data/s3-os-net.js',
  'js/data/s4-crypto.js',
  'js/data/s5-websec.js',
  'manifest.json'
  // Fonts and highlight.js are CDN, they'll be cached automatically when first used
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request).then(response => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, response.clone());
          return response;
        });
      });
    }).catch(() => {
      // Offline fallback - return the main page for HTML requests
      if (event.request.headers.get('accept')?.includes('text/html')) {
        return caches.match('index.html');
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});
