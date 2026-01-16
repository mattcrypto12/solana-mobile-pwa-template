/**
 * Solana Mobile PWA - Service Worker
 * Provides offline support and caching for the PWA
 */

const CACHE_NAME = 'solana-pwa-v24';
const OFFLINE_URL = '/offline.html';

// Files to cache immediately on install
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/styles.css',
    '/js/app.js',
    '/js/mwa.js',
    '/js/wallet.js',
    '/offline.html',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-512x512.png',
    '/assets/wallets/phantom.svg',
    '/assets/wallets/solflare.svg',
    '/assets/wallets/backpack.svg',
    '/assets/wallets/mwa.svg'
];

// API endpoints that should never be cached
const NETWORK_ONLY_PATTERNS = [
    /api\.mainnet-beta\.solana\.com/,
    /api\.devnet\.solana\.com/,
    /\/api\//
];

// Static assets that should be cached with cache-first strategy
const CACHE_FIRST_PATTERNS = [
    /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
    /\.(?:woff|woff2|ttf|otf|eot)$/,
    /\.(?:css|js)$/
];

// ==========================================================================
// Install Event
// ==========================================================================

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => {
                // Skip waiting to activate immediately
                return self.skipWaiting();
            })
    );
});

// ==========================================================================
// Activate Event
// ==========================================================================

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                );
            }),
            // Take control of all clients immediately
            self.clients.claim()
        ])
    );
});

// ==========================================================================
// Fetch Event
// ==========================================================================

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Only handle GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Network-only for API requests
    if (isNetworkOnlyRequest(url.href)) {
        event.respondWith(networkOnly(request));
        return;
    }
    
    // Cache-first for static assets
    if (isCacheFirstRequest(url.href)) {
        event.respondWith(cacheFirst(request));
        return;
    }
    
    // Network-first for HTML pages (to get fresh content)
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // Stale-while-revalidate for everything else
    event.respondWith(staleWhileRevalidate(request));
});

// ==========================================================================
// Caching Strategies
// ==========================================================================

/**
 * Cache-first strategy
 * Best for static assets that don't change often
 */
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        return new Response('Offline', { status: 503 });
    }
}

/**
 * Network-first strategy
 * Best for HTML pages to ensure fresh content
 */
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
        }
        
        return new Response('Offline', { status: 503 });
    }
}

/**
 * Network-only strategy
 * Best for API requests that should always be fresh
 */
async function networkOnly(request) {
    try {
        return await fetch(request);
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Network unavailable' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Stale-while-revalidate strategy
 * Returns cached content immediately while updating the cache in the background
 */
async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    // Fetch fresh content in the background
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(() => {
        // Network failed, return cached or error
        return cachedResponse || new Response('Offline', { status: 503 });
    });
    
    // Return cached response immediately if available, otherwise wait for network
    return cachedResponse || fetchPromise;
}

// ==========================================================================
// Helper Functions
// ==========================================================================

function isNetworkOnlyRequest(url) {
    return NETWORK_ONLY_PATTERNS.some((pattern) => pattern.test(url));
}

function isCacheFirstRequest(url) {
    return CACHE_FIRST_PATTERNS.some((pattern) => pattern.test(url));
}

// ==========================================================================
// Push Notifications
// ==========================================================================

self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/badge-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        },
        actions: data.actions || []
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const url = event.notification.data.url;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Focus existing window if available
                for (const client of clientList) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

// ==========================================================================
// Background Sync
// ==========================================================================

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-transactions') {
        event.waitUntil(syncTransactions());
    }
});

async function syncTransactions() {
    // Sync pending transactions when back online
    // This would be implemented based on your specific needs
}

// ==========================================================================
// Message Handler
// ==========================================================================

self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data === 'clearCache') {
        caches.keys().then((cacheNames) => {
            cacheNames.forEach((name) => caches.delete(name));
        });
    }
});
