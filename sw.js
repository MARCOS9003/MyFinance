const CACHE_NAME = 'myfinance-v16';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css?v=10',
    './script.js?v=10',
    './manifest.json',
    './icon.png',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0'
];

// Instalar y guardar en caché
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Interceptar peticiones y servir desde caché si no hay internet
self.addEventListener('fetch', (event) => {
    // Excluimos las peticiones a la API de Google (esas ya las gestiona tu script.js)
    if (event.request.url.includes('script.google.com')) return;

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

// Limpiar cachés antiguas al actualizar la app
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
