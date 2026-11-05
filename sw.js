const CACHE_NAME = "last-whistle-static-v530";
const APP_SHELL = ["./index.html", "./manifest.webmanifest", "./app-icon.svg", "./story-ui.css?v=1", "./social-media.css?v=2", "./story-mode.js?v=14", "./career-experience.css?v=2", "./career-experience.js?v=9", "./agent-system.css?v=1", "./agent-system.js?v=9", "./career-hub.css?v=2", "./career-hub.js?v=4", "./season-objectives.js?v=1", "./team-dynamics.js?v=3", "./player-store.css?v=2", "./ai-career-engine.js?v=7", "./transfer-awards-engine.js?v=27", "./football-world-ai.css?v=2", "./football-world-ai.js?v=83", "./lz-string.min.js?v=1", "./career-state-store.js?v=8", "./ai-career-ui.js?v=1", "./social-media.js?v=4", "./football-world-worker.js?v=72", "./football-world-rosters.js?v=6", "./football-world-db.js?v=11", "./world-roster-audit.json", "./data/global-catalog.js?v=1", "./data/career-engine.js?v=77", "./data/match-engine.js?v=82", "./data/snapshots/fifa-global-2023.json.gz.b64", "./data/snapshots/openfootball-clubs.json.gz.b64", "./data/snapshots/football-reference.json.gz.b64", "./data/snapshots/awards.json.gz.b64", "./redesign.css?v=17", "./ui-organization.css?v=5"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: url.indexOf("football-world-ai.js?") >= 0 || url.indexOf("football-world-db.js?") >= 0 || url.indexOf("football-world-worker.js?") >= 0 || url.indexOf("career-experience.js?") >= 0 || url.indexOf("career-hub.js?") >= 0 || url.indexOf("season-objectives.js?") >= 0 || url.indexOf("team-dynamics.js?") >= 0 || url.indexOf("career-state-store.js?") >= 0 || url.indexOf("transfer-awards-engine.js?") >= 0 || url.indexOf("ai-career-engine.js?") >= 0 || url.indexOf("social-media.js?") >= 0 || url.indexOf("data/career-engine.js?") >= 0 || url.indexOf("data/match-engine.js?") >= 0 ? "reload" : "default" })))).then(() => self.skipWaiting()));
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
