/* Service worker escrito a mano (unas 60 líneas) en lugar de next-pwa o
   workbox: la estrategia que necesita esta app cabe aquí y se lee entera.
   El caso de uso manda: el huésped aterriza en otro país sin datos y tiene que
   poder abrir la guía que consultó desde el wifi del aeropuerto.

   · Guías (/g/…)      → red primero, copia en caché; si no hay red, la copia.
   · Estáticos y QR    → caché primero (no cambian).
   · API y panel       → siempre red: nunca se sirve un dato caducado del piso. */

const CACHE = "retorika-stay-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/panel") || url.pathname.startsWith("/api/auth")) return;

  const isGuide = url.pathname.startsWith("/g/");
  const isCacheable =
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons") ||
    url.pathname.startsWith("/api/qr") ||
    url.pathname === "/manifest.webmanifest";

  if (isGuide) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match("/"))),
    );
    return;
  }

  if (isCacheable) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
