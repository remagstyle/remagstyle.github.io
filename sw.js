// RemagStyle service worker: offline fallback + faster repeat visits.
// Bump VERSION whenever you change the files listed in PRECACHE.
const VERSION = 'remagstyle-v1';
const PRECACHE = ['offline.html', 'site-theme.css', 'image/Logo.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return; // never touch Firebase, Google or other sites

    // Pages: always try the network first so visitors see your latest version.
    if (request.mode === 'navigate') {
        event.respondWith(fetch(request).catch(() => caches.match('offline.html')));
        return;
    }

    // Images, CSS, scripts: serve the saved copy fast, refresh it in the background.
    event.respondWith(
        caches.open(VERSION).then((cache) =>
            cache.match(request).then((saved) => {
                const fresh = fetch(request)
                    .then((response) => { if (response.ok) cache.put(request, response.clone()); return response; })
                    .catch(() => saved);
                return saved || fresh;
            })
        )
    );
});
