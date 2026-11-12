// عامل الخدمة — يجعل المنيو يفتح بدون إنترنت (مطلوب غالباً لتطبيقات APK)
// ملاحظة: الصفحات تُجلب من الإنترنت أولًا (يظهر التحديث فورًا) مع الرجوع للكاش عند انقطاع النت
const CACHE = 'shibani-menu-v2';
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const isPage = e.request.mode === 'navigate' || e.request.destination === 'document';

  // الصفحة: من الإنترنت أولًا، وإلا الكاش (وضع بدون إنترنت)
  if (isPage) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // باقي الملفات (أيقونات… إلخ): الكاش أولًا ثم الإنترنت
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }))
  );
});
