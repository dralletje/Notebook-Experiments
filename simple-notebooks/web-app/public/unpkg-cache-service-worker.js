// let self = /** @type {ServiceWorkerGlobalScope} */ (globalThis.self);

const RUNTIME = "runtime";

self.oninstall = () => {
  self.skipWaiting();
};
self.onactivate = () => {
  self.clients.claim();
};

self.addEventListener("fetch", (event) => {
  if (event.request.url.startsWith("https://unpkg.com/")) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return caches.open(RUNTIME).then((cache) => {
          return fetch(event.request).then((response) => {
            // Put a copy of the response in the runtime cache.
            return cache.put(event.request, response.clone()).then(() => {
              return response;
            });
          });
        });
      })
    );
  }
});
