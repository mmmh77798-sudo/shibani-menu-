// عامل الخدمة — يجعل المنيو يفتح بدون إنترنت (مطلوب غالباً لتطبيقات APK)
// الصفحات: إنترنت أولًا مع الرجوع للكاش عند انقطاعه | باقي الملفات: كاش أولًا
const CACHE = 'shibani-menu-v7';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './img/dishes/mandi-chicken.jpg',
  './img/dishes/mandi-lamb.jpg',
  './img/dishes/grilled-chicken.jpg',
  './img/dishes/grilled-lamb.jpg',
  './img/dishes/lamb-chops.jpg',
  './img/dishes/hanid.jpg',
  './img/dishes/mathbi-chicken.jpg',
  './img/dishes/biryani.jpg',
  './img/dishes/mixed-grill-family.jpg',
  './img/dishes/mango-juice.jpg',
  './img/dishes/karak-tea.jpg',
  './img/dishes/mezze.jpg'
];

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

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }))
  );
});
