const CACHE_NAME = 'zip-emulation-cache';

// Installation: Clean up the old emulation cache immediately
self.addEventListener('install', (event) => {
    console.log('[SW] Installing and deleting old cache...');
    event.waitUntil(
        caches.delete(CACHE_NAME)
    );
});

// Activation: Standard activation logic
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(clients.claim());
});

// 1. Message Listener: Receive files from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CACHE_ZIP_FILES') {
        console.log('[SW] Received files from main thread. Caching...');
        
        const files = event.data.files;

        // Use event.waitUntil to ensure the caching completes before the SW is terminated
        event.waitUntil(
            // Delete old cache first to ensure a fresh "site"
            caches.delete(CACHE_NAME).then(() => caches.open(CACHE_NAME)).then(cache => {
                
                const cachePromises = files.map(file => {
                    // Create a Request object (path) and a Response object (content Blob)
                    const url = new URL(file.path, self.location.origin).toString();
                    
                    // The Response constructor can accept a Blob directly
                    const response = new Response(file.blob);
                    
                    return cache.put(url, response).then(() => {
                        console.log(`[SW] Cached: ${file.path}`);
                    }).catch(err => {
                        console.error(`[SW] Failed to cache ${file.path}:`, err);
                    });
                });

                return Promise.all(cachePromises).then(() => {
                    // Send a confirmation message back to the main thread
                    if (event.source) {
                        event.source.postMessage({
                            type: 'CACHE_COMPLETE',
                            message: `**Emulation Ready!** Successfully cached ${files.length} files from the ZIP.`
                        });
                    }
                });
            })
        );
    }
});


// 2. Fetch Listener: Intercept requests and serve from cache
self.addEventListener('fetch', (event) => {
    const requestURL = new URL(event.request.url);
    const path = requestURL.pathname;

    // Only intercept requests for resources on the same origin
    if (requestURL.origin === self.location.origin) {
        // Look for the requested resource in the emulation cache
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(response => {
                    if (response) {
                        console.log(`[SW] Serving from cache: ${path}`);
                        return response; // Found in cache! Serve it.
                    }
                    
                    // If not in the emulation cache, proceed to network
                    console.log(`[SW] Passing through to network: ${path}`);
                    return fetch(event.request);
                });
            })
        );
    }
    // For cross-origin requests, let it proceed normally (i.e., fetch(event.request) is implicit).
});
