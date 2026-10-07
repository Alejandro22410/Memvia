// Service worker de Memvia: permite abrir la app sin conexión.
// Guarda la propia app y las librerías externas (Leaflet y tipografías).
// No guarda direcciones, rutas ni mapas: esas peticiones van siempre a internet.

const VERSION = 'memvia-v1';
const APP = [
  './', 'index.html', 'css/styles.css',
  'js/app.js', 'js/store.js', 'js/geo.js', 'js/map.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'
];
const EXTERNOS = ['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // Primero la red, para ver los cambios al recargar; sin conexión, la copia guardada.
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copia));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
    );
    return;
  }

  if (EXTERNOS.includes(url.hostname)) {
    // Primero la copia guardada: Leaflet y las tipografías no cambian.
    e.respondWith(
      caches.match(req).then((r) => r || fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copia = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copia));
        }
        return res;
      }))
    );
  }
});
