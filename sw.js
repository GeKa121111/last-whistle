const CACHE_NAME = "last-whistle-static-v136";
const APP_SHELL = ["./index.html", "./manifest.webmanifest", "./app-icon.svg", "./story-ui.css?v=1", "./story-mode.js?v=11", "./career-experience.css?v=1", "./career-experience.js?v=6", "./agent-system.css?v=1", "./agent-system.js?v=5", "./career-hub.css?v=1", "./career-hub.js?v=3", "./player-store.css?v=2", "./ai-career-engine.js?v=5", "./transfer-awards-engine.js?v=7", "./football-world-ai.css?v=1", "./football-world-ai.js?v=25", "./lz-string.min.js?v=1", "./career-state-store.js?v=1", "./ai-career-ui.js?v=1", "./football-world-worker.js?v=17", "./football-world-rosters.js?v=6", "./football-world-db.js?v=7", "./world-roster-audit.json", "./data/global-catalog.js?v=1", "./data/career-engine.js?v=4", "./data/match-engine.js?v=18", "./data/snapshots/fifa-global-2023.json.gz.b64", "./data/snapshots/openfootball-clubs.json.gz.b64", "./data/snapshots/football-reference.json.gz.b64", "./data/snapshots/awards.json.gz.b64", "./redesign.css?v=6"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
      return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    return response;
  })));
});
