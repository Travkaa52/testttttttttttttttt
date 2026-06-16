// Our Story — PWA Service Worker
// Версия кэша — при изменении медиафайлов увеличь число
const CACHE_VERSION = 'our-story-v1';

// Файлы для предварительного кэширования (статика)
const STATIC_ASSETS = [
  './',
  './index.html',
  './story.config.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&family=Cinzel:wght@300;400;600&family=EB+Garamond:ital,wght@1,400&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/TextPlugin.min.js',
];

// ── INSTALL: кэшируем статику ──────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      // Кэшируем по одному — если один не загрузился, не роняем всё
      return Promise.allSettled(
        STATIC_ASSETS.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('SW: не удалось закэшировать', url, err);
          });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: чистим старые кэши ──────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_VERSION; })
            .map(function(key) { return caches.delete(key); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── FETCH: стратегия Cache-First для медиа, Network-First для остального ──
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Только GET
  if (event.request.method !== 'GET') return;

  // Видео и аудио — Cache First (они тяжёлые, грузим один раз)
  var isMedia = /\.(mp4|webm|mov|m4v|mp3|ogg|aac|wav|m4a)(\?|$)/i.test(url);
  // Картинки — Cache First
  var isImage = /\.(jpg|jpeg|png|webp|gif|avif|svg)(\?|$)/i.test(url);
  // Шрифты и JS — Cache First
  var isStatic = /\.(woff2?|ttf|otf|js|css)(\?|$)/i.test(url) ||
                 url.includes('fonts.googleapis') ||
                 url.includes('fonts.gstatic') ||
                 url.includes('cdnjs.cloudflare');

  if (isMedia || isImage || isStatic) {
    // Cache First: сначала кэш, если нет — сеть, сохраняем в кэш
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          var toCache = response.clone();
          caches.open(CACHE_VERSION).then(function(cache) {
            cache.put(event.request, toCache);
          });
          return response;
        }).catch(function() {
          // Офлайн, нет в кэше — ничего не делаем
          return new Response('', { status: 408 });
        });
      })
    );
    return;
  }

  // Остальное (HTML, config) — Network First с fallback в кэш
  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response && response.status === 200) {
        var toCache = response.clone();
        caches.open(CACHE_VERSION).then(function(cache) {
          cache.put(event.request, toCache);
        });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request);
    })
  );
});
