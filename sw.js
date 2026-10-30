/* UNIVERS C.O — cache de l'interface seulement (page, icônes). Les données ne passent jamais par ici :
   les échanges avec le service Google sont des envois (POST) vers une autre adresse, non mis en cache.
   La page s'ouvre tout de suite depuis le cache ; la version en ligne est relue en arrière-plan pour l'ouverture suivante. */
var VERSION = 'univers-co-116c1f5707';
var FICHIERS = ['./', 'manifest.webmanifest', 'icone-192.png', 'icone-180.png', 'favicon.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FICHIERS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (L) { return Promise.all(L.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  var cle = e.request.mode === 'navigate' ? './' : e.request;
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(cle, { ignoreSearch: true }).then(function (garde) {
      var frais = fetch(e.request).then(function (r) { if (r && r.ok) c.put(cle, r.clone()); return r; });
      if (garde) { e.waitUntil(frais.catch(function () {})); return garde; }
      return frais;
    });
  }));
});
