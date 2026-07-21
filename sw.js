// Temporary root service worker: replaces the old prod SW that was scoped to
// /MartinOverdrive/ (which nested /dev/ and blocked a second phone install).
// Unregisters itself and drops only the old root-namespace caches so /app/ and
// /dev/ can each own a non-overlapping scope.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => {
      // Exact old root namespace (trailing slash). Never touch /app/ or /dev/ caches.
      if (key.endsWith(':/MartinOverdrive/')) return true
      // Pre-namespace legacy caches from early builds.
      if (/^overdrive-v\d+$/.test(key)) return true
      return false
    }).map((key) => caches.delete(key)))
    await self.registration.unregister()
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const client of clients) {
      // Nudge open root tabs onto /app/ once the controlling SW is gone.
      if (client.url && /\/MartinOverdrive\/?(\?|#|$)/.test(client.url) && !/\/(app|dev)\//.test(client.url)) {
        client.navigate(client.url.replace(/\/MartinOverdrive\/?/, '/MartinOverdrive/app/'))
      }
    }
  })())
})
