const CACHE_NAME = "portal-dma-v17";

const APP_ASSETS = [
  "./",
  "./index.html",
  "./aedes.html",
  "./recicla.html",
  "./manifest.json",

  "./css/global.css",
  "./css/home.css",
  "./css/recicla.css",
  "./css/aedes.css",

  "./js/home.js",
  "./js/recicla.js",
  "./js/db.js",
  "./js/seed.js",
  "./js/certs.js",
  "./js/aedes.js",
  "./js/aedes-publico.js",

  "./data/recicla-pagina.json",

  "./assets/icon.png",
  "./assets/folder-arboviroses.jpg"
];

// ----------------------------
// INSTALL
// ----------------------------
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      for (const asset of APP_ASSETS) {
        try {
          await cache.add(asset);
        } catch (error) {
          console.warn("[SW] Falha ao adicionar no cache:", asset, error);
        }
      }
    })()
  );
});

// ----------------------------
// ACTIVATE
// ----------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ----------------------------
// FETCH
// ----------------------------
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // ❗ BLOQUEIO CRÍTICO: ignora chrome-extension, blob, file etc
  const url = new URL(request.url);
  if (!["http:", "https:"].includes(url.protocol)) {
    return;
  }

  if (request.method !== "GET") return;

  // ----------------------------
  // NAVEGAÇÃO (HTML)
  // ----------------------------
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone).catch(() => {});
            });
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;

          const fallbackPage = await caches.match("./index.html");
          if (fallbackPage) return fallbackPage;

          return new Response("Página indisponível no modo offline.", {
            status: 503,
            statusText: "Offline",
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        })
    );
    return;
  }

  // ----------------------------
  // OUTROS RECURSOS
  // ----------------------------
  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) {
        // atualiza em background
        fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone).catch(() => {});
              });
            }
          })
          .catch(() => {});

        return cached;
      }

      try {
        const response = await fetch(request);

        if (response && response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch(() => {});
          });
        }

        return response;
      } catch (_error) {
        return new Response("Recurso indisponível.", {
          status: 503,
          statusText: "Offline",
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })
  );
});
