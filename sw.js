// Service worker de Memvia.
// - Archivos de la propia app: primero red, y si no hay internet, copia guardada.
// - Librerías externas (Leaflet, iconos, letras): primero copia guardada.
// - Firebase, mapas, buscador de direcciones y rutas: no se tocan (siempre en directo).
const VERSION = 'memvia-v5';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/styles.css',
  'js/app.js', 'js/config.js', 'js/demo.js', 'js/buscador.js', 'js/mapa.js', 'js/geo.js',
  'icons/icon192.png', 'icons/icon512.png', 'icons/icon-maskable-512.png'
];
const CDN = ['unpkg.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(req, copia)); }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
    );
    return;
  }

  if (CDN.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(req, copia)); }
        return res;
      }))
    );
  }
});
