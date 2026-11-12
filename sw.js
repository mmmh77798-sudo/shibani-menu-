// عامل الخدمة — يجعل المنيو يفتح بدون إنترنت (مطلوب غالباً لتطبيقات APK)
// الصفحات: إنترنت أولًا مع الرجوع للكاش عند انقطاعه | باقي الملفات: كاش أولًا
const CACHE = 'shibani-menu-v10';
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
  './img/dishes/mezze.jpg',
  './img/logo.jpg'
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
      }).catch(() =>
        caches.match('./index.html').then(cached => {
          if (cached) return cached;
          return fetch('./index.html').catch(() => new Response(
            '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>منيو الشيباني ماستر</title><style>body{font-family:system-ui;background:#fdf6ec;color:#292524;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:20px;box-sizing:border-box}h1{color:#b91c1c}a{background:#b91c1c;color:#fff;padding:14px 28px;border-radius:99px;text-decoration:none;font-weight:800;margin-top:18px}</style></head><body><h1>🍽️ مطاعم الشيباني ماستر</h1><p>انقطع الاتصال مؤقتًا — اسحب للأسفل أو اضغط الزر</p><a href="https://shibani-47cdd.web.app/">إعادة المحاولة</a></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          ));
        })
      )
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
