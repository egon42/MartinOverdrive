const BASE = new URL('.', self.location).pathname
// Cache is namespaced by base path so the /app/ and /dev/ deployments
// (same origin) never delete each other's entries on activate.
const CACHE = `overdrive-v6:${BASE}`
const shellPath = (path = '') => `${BASE}${path.replace(/^\//, '')}`

// How long a navigation waits on the network before serving the cached app. A dead
// network fails fast on its own; this exists for the one-bar venue network that
// neither succeeds nor fails — without it the app can hang for 30s+ on a screen
// that is fully cached.
const NAV_TIMEOUT_MS = 2500

const SHELL = [
  BASE,
  shellPath('index.html'),
  shellPath('manifest.webmanifest'),
  // Versioned filenames so phone home-screen installs pick up new art (iOS caches
  // apple-touch-icon by URL aggressively). Bump the -vN suffix when icons change.
  shellPath('icon-v2.png'),
  shellPath('icon-dev-v2.png'),
  shellPath('martin-drive-logo.jpg'),
  shellPath('martin-drive-logo-dev.jpg'),
  shellPath('raleway-400.ttf'),
  shellPath('raleway-600.ttf'),
  shellPath('raleway-700.ttf'),
  shellPath('raleway-800.ttf'),
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Per-URL add so one missing shell file cannot abort the whole install
      // (that used to leave the previous SW — and its icons — stuck forever).
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    const stale = keys.filter((key) => key !== CACHE && (key.endsWith(`:${BASE}`) || !key.includes(':')))
    // Carry runtime-cached entries (the hashed /assets/ bundles) across the version
    // bump before deleting the old cache — otherwise the first offline launch after
    // an upgrade has the shell but none of its JS/CSS. Anything the fresh cache
    // already holds (the just-precached shell) wins over the old copy.
    const fresh = await caches.open(CACHE)
    for (const key of stale) {
      // Only migrate from this deployment's own namespace. Legacy un-namespaced caches
      // hold the OTHER deployment's URLs too — importing those would let a stale prod
      // shell shadow prod's cache from inside the dev cache forever (caches.match
      // searches caches in creation order). Legacy caches are deleted, not migrated.
      if (!key.endsWith(`:${BASE}`)) continue
      const old = await caches.open(key)
      for (const request of await old.keys()) {
        if (await fresh.match(request)) continue
        const url = request.url
        // Never migrate unhashed shell/icons/manifest — those are exactly what a
        // version bump is trying to replace.
        if (/\/(index\.html|manifest\.webmanifest|icon[^/]*|martin-drive-logo[^/]*)$/.test(url)) continue
        const response = await old.match(request)
        // ok-filter: v4 cached 404s/opaqueredirects unconditionally; don't carry
        // junk into a cache whose read path is cache-first-forever.
        if (response && response.ok) await fresh.put(request, response)
      }
    }
    await Promise.all(stale.map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

// Cache successful responses only — a cached 404/500 would otherwise be served
// forever by the cache-first branch below.
const cachePut = (request, response) => {
  if (response.ok) {
    const copy = response.clone()
    caches.open(CACHE).then((cache) => cache.put(request, copy))
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return

  if (request.mode === 'navigate') {
    // Network-first so app updates land (the fix in 8904e94) — but the network only
    // gets NAV_TIMEOUT_MS before the cached shell is served instead. If there's no
    // cache yet (first ever visit), keep waiting on the network however slow it is.
    event.respondWith((async () => {
      const network = fetch(request).then((response) => cachePut(request, response))
      network.catch(() => { /* may reject after we've already answered from cache */ })
      try {
        const winner = await Promise.race([
          network,
          new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS)),
        ])
        if (winner) return winner
      } catch { /* network failed outright — fall through to cache */ }
      const cached = (await caches.match(request)) || (await caches.match(shellPath('index.html')))
      return cached || network
    })())
    return
  }

  const path = new URL(request.url).pathname
  // Manifest + icons are not content-hashed — network-first so a new install sees
  // the current art. Hashed /assets/ and fonts stay cache-first below.
  if (/\/(manifest\.webmanifest|icon[^/]*)$/.test(path)) {
    event.respondWith(
      fetch(request).then((response) => cachePut(request, response)).catch(() => caches.match(request)),
    )
    return
  }

  // Everything else same-origin — hashed /assets/ bundles, fonts — is
  // cache-first: the JS/CSS filenames are content-hashed, so a cached copy can
  // never be stale, and skipping the network avoids the slow-network hang.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => cachePut(request, response))),
  )
})
