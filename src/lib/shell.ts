/** Cache name for the offline app shell. Bump the suffix to invalidate old caches. */
export const SHELL_CACHE = 'island-shell-v1';

/** Paths precached by the service worker so the home page works offline. */
export const SHELL_URLS = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
