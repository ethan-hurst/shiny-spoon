// Service Worker for Inventory Management System
const CACHE_NAME = 'inventory-v1'
const RUNTIME_CACHE = 'runtime-v1'

// URLs to cache on install
const urlsToCache = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
]

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Install')
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell')
        return cache.addAll(urlsToCache)
      })
      .then(() => self.skipWaiting())
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate')
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          })
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch event - serve from cache when possible
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip requests to different origins
  if (!request.url.startsWith(self.location.origin)) return

  // Handle API requests differently
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response
          const responseToCache = response.clone()

          // Cache successful API responses
          if (response.status === 200) {
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache)
            })
          }

          return response
        })
        .catch(() => {
          // Try to return cached API response
          return caches.match(request)
        })
    )
    return
  }

  // For app navigation, use network-first strategy
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return caches.match(request).then((response) => {
            return response || caches.match('/offline')
          })
        })
    )
    return
  }

  // For everything else, use cache-first strategy
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response
      }

      return fetch(request).then((response) => {
        // Check if valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }

        // Clone the response
        const responseToCache = response.clone()

        // Cache the response
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, responseToCache)
        })

        return response
      })
    })
  )
})

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag)
  
  if (event.tag === 'sync-inventory') {
    event.waitUntil(syncInventoryData())
  }
})

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push event')
  
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Inventory Alert'
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || [],
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click')
  
  event.notification.close()

  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  )
})

// Helper function to sync inventory data
async function syncInventoryData() {
  try {
    // Get all pending sync requests from IndexedDB
    // This would be implemented with actual sync logic
    console.log('[SW] Syncing inventory data...')
    
    // Placeholder for actual sync implementation
    return Promise.resolve()
  } catch (error) {
    console.error('[SW] Sync failed:', error)
    throw error
  }
}