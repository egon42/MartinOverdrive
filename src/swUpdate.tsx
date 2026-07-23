import { useEffect, useState } from 'react'
import { assetUrl, baseUrl } from './base'

/** Prod-only: register the SW, poll for deploys, and offer a tap-to-refresh
 * when a new worker takes over. Dev server has no SW (matches prior main.tsx). */
export function SwUpdateBanner() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

    let cancelled = false
    // First controller acquisition is install, not an update — don't prompt.
    const hadController = !!navigator.serviceWorker.controller

    const onControllerChange = () => {
      if (cancelled || !hadController) return
      setReady(true)
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    let registration: ServiceWorkerRegistration | undefined
    const onVis = () => {
      if (document.visibilityState === 'visible') void registration?.update()
    }
    let intervalId = 0

    void navigator.serviceWorker
      .register(assetUrl('sw.js'), { scope: baseUrl })
      .then((reg) => {
        if (cancelled) return
        registration = reg
        // Waiting worker (rare with skipWaiting) — already installed, just not active.
        if (reg.waiting && hadController) setReady(true)

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing
          if (!worker) return
          worker.addEventListener('statechange', () => {
            // Installed while we already control the page ⇒ update ready (skipWaiting
            // will activate immediately; controllerchange also fires).
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              setReady(true)
            }
          })
        })

        // Browsers only auto-check the SW on navigation (~24h). A parked PWA needs
        // an explicit update() — on focus and on a slow interval.
        document.addEventListener('visibilitychange', onVis)
        intervalId = window.setInterval(() => { void reg.update() }, 60_000)
        void reg.update()
      })
      .catch(() => { /* offline / blocked — stay on whatever is cached */ })

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', onVis)
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [])

  if (!ready) return null

  return (
    <button
      type="button"
      className="sw-update-banner"
      onClick={() => window.location.reload()}
    >
      New version. Tap to refresh
    </button>
  )
}
