// Service worker mínimo: Chrome/Android exige uno (con un listener de
// "fetch" que responda) para considerar la app "instalable" de verdad, no
// solo como acceso directo. No cachea nada — solo deja pasar la red.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
