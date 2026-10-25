const CACHE_NAME = 'collabee-cache-v1'
const PRECACHE_URLS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']

// Install event: Precache core static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  )
})

// Fetch event: Cache-first for static hashed assets, Network-first for navigation with offline fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Do not intercept non-GET requests or server API calls
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return
  }

  // Static hashed build assets (JS, CSS, images)
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
          }
          return networkResponse
        })
      }),
    )
    return
  }

  // HTML navigation requests: Network first with offline fallback to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
          }
          return networkResponse
        })
        .catch(async () => {
          const cachedIndex = await caches.match('/index.html')
          if (cachedIndex) return cachedIndex
          return caches.match('/')
        }),
    )
  }
})
