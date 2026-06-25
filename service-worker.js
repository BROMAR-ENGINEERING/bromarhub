// ============================================
// BROMAR HUB - SERVICE WORKER
// Enables PWA functionality and offline access
// ============================================

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `bromar-hub-${CACHE_VERSION}`;

// Files to cache for offline use
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.png',
    '/Bromar-Primary-Logo-Full-Colour.png',
    '/Bromar-Primary-Logo-Reverse-White.png',
    '/tools/bromar-hub.css',
    '/tools/bromar-hub.js',
    '/tools/auth.js'
];

// ============================================
// INSTALL - Cache static assets
// ============================================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[SW] Some assets failed to cache:', err);
            });
        })
    );
    self.skipWaiting();
});

// ============================================
// ACTIVATE - Clean up old caches
// ============================================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('bromar-hub-') && name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// ============================================
// FETCH - Network first, fallback to cache
// ============================================
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip Supabase API calls - always go to network
    if (event.request.url.includes('supabase.co')) return;
    
    // Skip Netlify functions - always go to network
    if (event.request.url.includes('/.netlify/functions/')) return;
    if (event.request.url.includes('/api/')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache successful responses
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Network failed - try cache
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    
                    // If it's a navigation request and no cache, show index
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

// ============================================
// MESSAGE - Handle update messages from page
// ============================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
