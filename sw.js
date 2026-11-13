// عامل خدمة مُزيل — يقتل نفسه ويحذف كل النسخ القديمة ثم يختفي نهائيًا.
// (كان سبب الشاشة البيضاء المتكررة — إزالته تعني: المنيو يتصرف دائمًا كنسخة حية طازجة)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.map(k => caches.delete(k))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(clients => clients.forEach(c => { try { c.navigate(c.url); } catch (e) {} }))
));
// عمداً: لا يوجد مستمع fetch — كل الطلبات تذهب للشبكة مباشرة
