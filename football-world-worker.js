/* LAST WHISTLE world-simulation worker: season jobs execute away from the UI thread. */
"use strict";
self.window = self;
let engineReady = false;
function ensureEngines() {
  if (engineReady && self.LWWorldAI && self.LWWorldDB) return;
  importScripts("./football-world-rosters.js?v=6", "./football-world-db.js?v=7", "./football-world-ai.js?v=24");
  if (!self.LWWorldAI || !self.LWWorldDB) throw new Error("World modules failed to initialize in worker");
  engineReady = true;
}
self.addEventListener("message", function (event) {
  const data = event && event.data || {};
  try {
    ensureEngines();
    const save = data.save;
    if (!save || typeof save !== "object") throw new Error("A career save is required");
    let result;
    if (data.command === "completeSeason") result = self.LWWorldAI.completeSeason(save, data.season, self.LWWorldDB);
    else if (data.command === "advanceToSeason") result = self.LWWorldAI.advanceToSeason(save, data.season, self.LWWorldDB);
    else if (data.command === "dashboard") result = self.LWWorldAI.dashboard(save, self.LWWorldDB);
    else throw new Error("Unsupported world worker command: " + String(data.command));
    self.postMessage({ id: data.id, ok: true, command: data.command, result: result, save: save });
  } catch (error) {
    self.postMessage({ id: data.id, ok: false, command: data.command,
      error: String(error && error.message || error), stack: String(error && error.stack || "") });
  }
});
