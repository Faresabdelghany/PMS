// Service Worker for static asset caching
// Improves INP by reducing network requests for static assets

const CACHE_NAME = 'pms-cache-v1'
const STATIC_ASSETS = [
  '/',
  '/icon.png',
  '/apple-touch-icon.png',
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  // Activate immediately
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  // Take control immediately
  self.clients.claim()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return
  }

  // Skip authentication and API requests
  const url = new URL(event.request.url)
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('vercel.app')
  ) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response and update cache in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse)
            })
          }
        })
        return cachedResponse
      }

      // Not in cache, fetch from network and cache it
      return fetch(event.request).then((response) => {
        // Cache successful responses for static assets
        if (
          response &&
          response.status === 200 &&
          (event.request.url.endsWith('.js') ||
            event.request.url.endsWith('.css') ||
            event.request.url.endsWith('.png') ||
            event.request.url.endsWith('.jpg') ||
            event.request.url.endsWith('.svg') ||
            event.request.url.endsWith('.woff2'))
        ) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
        }

        return response
      })
    })
  )
})
