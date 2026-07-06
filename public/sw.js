const BASE = new URL('.', self.location).pathname
// Cache is namespaced by base path so the / and /dev/ deployments (same origin)
// never delete each other's entries on activate.
const CACHE = `overdrive-v4:${BASE}`
const shellPath = (path = '') => `${BASE}${path.replace(/^\//, '')}`

const SHELL = [
  BASE,
  shellPath('index.html'),
  shellPath('manifest.webmanifest'),
  shellPath('icon.svg'),
  shellPath('martin-drive-logo.jpg'),
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== CACHE && (key.endsWith(`:${BASE}`) || !key.includes(':')))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return

  const url = new URL(event.request.url)
  const networkFirst = event.request.mode === 'navigate' || url.pathname.includes('/assets/')

  event.respondWith(
    networkFirst
      ? fetch(event.request)
          .then((response) => {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(event.request, copy))
            return response
          })
          .catch(() => caches.match(event.request).then((cached) => cached || (event.request.mode === 'navigate' ? caches.match(shellPath('index.html')) : undefined)))
      : caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          return response
        })),
  )
})
