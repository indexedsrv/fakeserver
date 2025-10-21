const CACHE_NAME = 'zip-emulation-cache';

self.addEventListener('install', (event) => {
    console.log('[SW] Installing and deleting old cache...');
    event.waitUntil(
        caches.delete(CACHE_NAME)
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CACHE_ZIP_FILES') {
        console.log('[SW] Received files from main thread. Caching...');
        
        const files = event.data.files;

        event.waitUntil(
            caches.delete(CACHE_NAME).then(() => caches.open(CACHE_NAME)).then(cache => {
                
                const cachePromises = files.map(file => {
                    const url = new URL(file.path, self.location.origin).toString();
                    
                    const response = new Response(file.blob);
                    
                    return cache.put(url, response).then(() => {
                        console.log(`[SW] Cached: ${file.path}`);
                    }).catch(err => {
                        console.error(`[SW] Failed to cache ${file.path}:`, err);
                    });
                });

                return Promise.all(cachePromises).then(() => {
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


self.addEventListener('fetch', (event) => {
    const requestURL = new URL(event.request.url);
    const path = requestURL.pathname;

    if (requestURL.origin === self.location.origin) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(response => {
                    if (response) {
                        console.log(`[SW] Serving from cache: ${path}`);
                        return response;
                    }
                    
                    console.log(`[SW] Passing through to network: ${path}`);
                    return fetch(event.request);
                });
            })
        );
    }
});
