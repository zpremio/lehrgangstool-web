/**
 * Service Worker der Webversion.
 *
 * Zweck: Die App soll nach dem ersten Aufruf auch ohne Internet starten – auf
 * Lehrgängen ist das WLAN oft nicht vorhanden. Teilnehmerdaten sind davon nicht
 * betroffen, die liegen ohnehin nur im Browser und werden nie übertragen.
 *
 * Strategie: aus dem Cache antworten, parallel im Hintergrund aktualisieren.
 * Dadurch startet die App sofort und holt sich neue Versionen von selbst.
 * 1.0.3 wird beim Bauen ersetzt und wirft alte Caches weg.
 */
const CACHE = 'lehrgangs-uebertrag-1.0.3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;

  // Die Seite selbst immer zuerst aus dem Netz holen: Korrekturen sollen beim
  // nächsten Aufruf ankommen und nicht erst beim übernächsten. Der Zwischen-
  // speicher springt nur ein, wenn gerade kein Netz da ist.
  const istSeite = req.mode === 'navigate'
    || (req.headers.get('accept') || '').includes('text/html');

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    if (istSeite) {
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        return (await cache.match(req)) || (await cache.match('./index.html')) || Response.error();
      }
    }

    // Beiwerk (Icons, Manifest): aus dem Speicher antworten, im Hintergrund erneuern.
    const gespeichert = await cache.match(req);
    const ausDemNetz = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => gespeichert);
    return gespeichert || ausDemNetz;
  })());
});
