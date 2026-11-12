/* PERSONAL OS — Cache applicatif hors ligne.
   STRATÉGIE : réseau d'abord pour les fichiers applicatifs.
   Ainsi, toute correction est prise en compte dès le rechargement,
   même si une ancienne version a été mise en cache. */

const CACHE = 'personal-os-shell-v3.3.0';
const SHELL = [
  './', './index.html', './style.css', './theme-os.css', './maison-hub.css', './script.js', './manifest.json', './icon.svg',
  './js/layout.js', './js/core.js', './js/ui.js', './js/view-state.js', './js/views.js',
  './js/views-primary.js', './js/views-operations.js', './js/views-reminders.js',
  './js/voice.js', './js/sophie.js', './js/tts.js', './js/news.js',
  './js/alarms.js', './js/focus.js', './js/reminders.js',
  './js/views-maison.js', './js/maison-hub.js', './js/camera.js', './js/sophie-avatar.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL).catch(() => undefined)) // un fichier absent n'empêche pas l'installation
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('personal-os-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

/* Réseau d'abord, puis cache : le code est toujours à jour, l'offline reste possible. */
async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE);
  try {
    // 'no-cache' : revalide toujours auprès du serveur. Sans cela, GitHub Pages (Cache-Control: max-age=600)
    // peut servir pendant 10 minutes une ancienne version, même en « réseau d'abord ».
    const response = await fetch(request, { cache: 'no-cache' });
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return new Response('Hors ligne — ressource non disponible.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Météo, actualités, Spotify et ElevenLabs restent en comportement réseau natif.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }
  event.respondWith(networkFirst(request));
});
