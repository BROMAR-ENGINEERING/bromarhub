// ============================================
// BROMAR HUB - SERVICE WORKER (/sw.js)
// PWA + Push Notifications
// ============================================

const CACHE_VERSION = 'v1.1.0';
const CACHE_NAME = `bromar-hub-${CACHE_VERSION}`;

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/icons/icon-32x32.png',
    '/assets/logo/bromar-logo-colour.png',
    '/assets/logo/bromar-logo-white.png',
    '/tools/bromar-hub.css',
    '/tools/bromar-hub.js',
    '/tools/auth.js',
    '/tools/push-subscribe.js'
];

// ============================================
// INSTALL
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
// ACTIVATE
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
// FETCH - Network first, fall back to cache
// ============================================
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('supabase.co')) return;
    if (event.request.url.includes('/.netlify/functions/')) return;
    if (event.request.url.includes('/api/')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

// ============================================
// MESSAGE
// ============================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ============================================
// PUSH NOTIFICATIONS
// ============================================
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Bromar Schedule Update';
    const options = {
        body: data.body || 'You have a schedule change',
        icon: '/assets/icons/graphite-192.png',
        badge: '/assets/icons/graphite-72.png',
        tag: 'schedule-' + (data.id || Date.now()),
        renotify: true,
        data: { url: data.url || '/' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
            }
            return clients.openWindow(url);
        })
    );
});
