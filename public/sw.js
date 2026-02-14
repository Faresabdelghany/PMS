// Service Worker for static asset caching
// Improves INP by reducing network requests for static assets

const CACHE_NAME = 'pms-cache-v3'
const STATIC_ASSETS = [
  '/',
  '/icon.png',
  '/apple-touch-icon.png',
  '/offline.html',
  '/manifest.webmanifest',
]

// Install event - cache static assets
globalThis.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  // Activate immediately
  globalThis.skipWaiting()
})

// Activate event - clean up old caches
globalThis.addEventListener('activate', (event) => {
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
  globalThis.clients.claim()
})

// Fetch event - serve from cache, fallback to network
globalThis.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return
  }

  // Skip authentication and API requests
  const url = new URL(event.request.url)
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.includes('supabase.co')
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
      return fetch(event.request)
        .then((response) => {
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
        .catch(() => {
          // Network failed — serve offline fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html')
          }
          return new Response('', { status: 408 })
        })
    })
  )
})
