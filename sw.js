/* Sổ Chi Tiêu Gia Đình — service worker cho PWA */
var CACHE = 'sochitieu-v20261127b';
var SHELL = [
  './index.html',
  './assets/app.min.css?v=20261127a',
  './assets/app.min.js?v=20261127a',
  './assets/favicon.svg',
  './manifest.json'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // cache: 'reload' để không lấy index/CSS/JS cũ từ HTTP cache khi deploy bản mới.
      var requests = SHELL.map(function (url) {
        return new Request(new URL(url, self.location.href).href, { cache: 'reload' });
      });
      return cache.addAll(requests);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    // Trang chủ dùng cache để giảm tải GitHub; SW mới sẽ thay cache khi deploy.
    // Trang đặt lại mật khẩu cần token mới nên luôn đi mạng.
    if (url.pathname.indexOf('/reset-password.html') !== -1) {
      event.respondWith(fetch(req));
      return;
    }
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return caches.match('./index.html').then(function (fallback) {
          return fallback || fetch(req);
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(req, copy);
          });
        }
        return res;
      });
    })
  );
});
