/* UNIVERS C.O — cache de l'interface seulement (page, icônes). Les données ne passent jamais par ici :
   les échanges avec le service Google sont des envois (POST) vers une autre adresse, non mis en cache.
   La page s'ouvre tout de suite depuis le cache ; la version en ligne est relue en arrière-plan pour l'ouverture suivante. */
var VERSION = 'univers-co-cf4e7e8eff';
// Session gardée par la page pour les notifications (adresse du service + jeton) : jamais effacée par une mise à jour
var SESSION_SW = 'dx-session';
// cache: 'reload' : la nouvelle version est relue chez GitHub, jamais reprise du cache du navigateur (10 min)
var FICHIERS = ['./', 'manifest.webmanifest', 'icone-192.png', 'icone-180.png', 'favicon.png', 'fond-accueil.jpg'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FICHIERS.map(function (f) { return new Request(f, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  var maj = false;
  e.waitUntil(caches.keys().then(function (L) {
    var vieux = L.filter(function (k) { return k !== VERSION && k !== SESSION_SW; });
    maj = vieux.some(function (k) { return k.indexOf('univers-co-') === 0; });
    return Promise.all(vieux.map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); })
    .then(function () { return maj ? rechargerAnciennes() : null; }));
});
/* Mise à jour : les pages d'avant la v29 n'ont pas le bandeau « Mettre à jour » ; elles ne répondent pas à la question
   « version ? » et sont rechargées d'office. Les pages récentes répondent et affichent elles-mêmes le bandeau. */
function rechargerAnciennes() {
  return self.clients.matchAll({ type: 'window' }).then(function (L) {
    return Promise.all(L.map(function (c) {
      return new Promise(function (fin) {
        var canal = new MessageChannel(), repondu = false;
        canal.port1.onmessage = function () { repondu = true; fin(); };
        try { c.postMessage({ dx: 'version?' }, [canal.port2]); } catch (err) {}
        setTimeout(function () {
          if (!repondu && c.navigate) { try { c.navigate(c.url).catch(function () {}); } catch (err) {} }
          fin();
        }, 2500);
      });
    }));
  });
}
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  var cle = e.request.mode === 'navigate' ? './' : e.request;
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(cle, { ignoreSearch: true }).then(function (garde) {
      // no-cache : revalide auprès de GitHub (sinon le cache du navigateur peut resservir l'ancienne page pendant 10 minutes)
      var frais = fetch(new Request(u.href, { cache: 'no-cache', credentials: 'same-origin' })).then(function (r) { if (r && r.ok) c.put(cle, r.clone()); return r; });
      if (garde) { e.waitUntil(frais.catch(function () {})); return garde; }
      return frais;
    });
  }));
});

/* Notifications (03/11/2026) : le signal reçu est vide ; le téléphone demande le détail de l'alerte à UNIVERS C.O avec la session
   gardée par la page, puis l'affiche. Sans réseau ou sans session, une notification générale s'affiche quand même (exigé par Apple). */
self.addEventListener('push', function (e) {
  e.waitUntil(caches.open(SESSION_SW).then(function (c) { return c.match('./dx-session'); })
    .then(function (r) { return r ? r.json() : null; })
    .then(function (s) {
      if (!s || !s.api || !s.jeton) return null;
      return fetch(s.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: 'apiNotifDerniere', args: [s.jeton] }) })
        .then(function (r) { return r.json(); }).then(function (o) { return o && o.ok ? o.r : null; });
    })
    .catch(function () { return null; })
    .then(function (a) {
      return self.registration.showNotification((a && a.titre) || 'UNIVERS C.O', { body: (a && a.texte) || 'Nouvelle alerte dans le Journal d’activité.',
        icon: 'icone-192.png', badge: 'icone-192.png', tag: (a && a.tag) || 'alerte', data: { url: (a && a.url) || './#journal' } });
    }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './#journal';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (L) {
    if (L.length) { L[0].postMessage({ dx: 'aller', url: url }); return L[0].focus(); }
    return self.clients.openWindow(url);
  }));
});
