// Minimal no-op service worker to suppress 404 errors from browser extensions.
// This project does not use a service worker.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => { });
