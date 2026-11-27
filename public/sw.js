// Service worker: caches the app shell so the home page opens offline.
// Keep SHELL_CACHE / SHELL_URLS in step with src/lib/shell.ts (a unit test checks this).
const SHELL_CACHE = 'island-shell-v1';
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
// Sessions the listener saved for offline (keep in step with SESSION_CACHE in src/lib/shell.ts).
const SESSION_CACHE = 'island-sessions-v1';
// Filled in at build time by scripts/precache-assets.mjs with the hashed CSS/JS files.
const BUILT_ASSETS = [];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll([...SHELL_URLS, ...BUILT_ASSETS])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== SESSION_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// "Save for offline": the page asks the worker to cache a session's page and audio.
// Only same-origin paths are accepted; the reply says whether every file was stored.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'save-session' || !Array.isArray(data.urls)) return;
  const port = event.ports && event.ports[0];
  const urls = data.urls.filter((u) => typeof u === 'string' && u.startsWith('/') && !u.startsWith('//'));
  event.waitUntil(
    caches.open(SESSION_CACHE)
      .then((cache) => Promise.all(urls.map((u) => fetch(u, { cache: 'reload' }).then((res) => {
        if (res.status !== 200) throw new Error('bad status ' + res.status);
        return cache.put(u, res);
      }))))
      .then(() => port && port.postMessage({ ok: true }))
      .catch(() => port && port.postMessage({ ok: false })),
  );
});

// Audio elements ask for byte ranges; a stored full response must be answered with a 206 slice.
function rangeResponse(req, hit) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  if (!m || hit.status !== 200) return Promise.resolve(hit);
  return hit.arrayBuffer().then((buf) => {
    const size = buf.byteLength;
    let start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
    let end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
    return new Response(buf.slice(start, end + 1), {
      status: 206,
      headers: {
        'Content-Type': hit.headers.get('Content-Type') || 'audio/mpeg',
        'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
        'Content-Length': String(end - start + 1),
      },
    });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.status === 200) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => (hit ? rangeResponse(req, hit) : caches.match('/')))),
  );
});
