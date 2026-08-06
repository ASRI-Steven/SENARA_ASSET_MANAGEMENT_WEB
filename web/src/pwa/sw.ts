/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

// autoUpdate: activate a newly-installed SW immediately and take control of all
// open tabs, so a fresh build replaces the old precached bundle on next reload
// (no stuck-in-"waiting" SW serving stale JS).
self.skipWaiting()
clientsClaim()

// App-shell precache (injected at build time by vite-plugin-pwa).
precacheAndRoute(self.__WB_MANIFEST)

// SPA navigation fallback → precached index.html.
registerRoute(
  new NavigationRoute(
    async ({ event }) => {
      try {
        const res = await fetch((event as FetchEvent).request)
        return res
      } catch {
        const cache = await caches.open('offline-fallback-v1')
        const offline = await cache.match('/offline.html')
        return offline ?? Response.error()
      }
    },
    { denylist: [/^\/api\//] },
  ),
)

// Runtime-cache only GET reads from the BFF. Mutations stay network-only.
registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
  new StaleWhileRevalidate({
    cacheName: 'asrilup-api-get',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 5 * 60 })],
  }),
)

// Cache the offline fallback page on install.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('offline-fallback-v1').then((cache) => cache.add('/offline.html')),
  )
})
