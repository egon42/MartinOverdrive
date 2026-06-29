const CACHE = 'overdrive-v2'
const BASE = new URL('.', self.location).pathname
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
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached

      return fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          return response
        })
        .catch(() => {
          if (event.request.mode !== 'navigate') return undefined
          return caches.match(BASE) || caches.match(shellPath('index.html'))
        })
    }),
  )
})
