# Typescript webworker

A module/webworker combo that will run typescript-server on a virtual filesystem in a worker.
It will fetch modules automatically from `https://unpkg.com/`, albeit not very effecient.

## Depends on vite

I use [Vite's glob import](https://vitejs.dev/guide/features.html#glob-import) to load the typescript libraries.
Should just take those from unpkg too, but this works and I'm done touching the module loading stuff for a bit.

## Service worker optimisation

To make typescript not fetch all the files (and all the misses) all the time,
I'd suggest adding a service worker that caches unpkg urls.

```javascript
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
```
