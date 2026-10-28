"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const fixture = {
  schemaVersion: 1,
  refreshRevision: 3,
  season: "2026/27",
  source: "Synthetic worker lifecycle fixture",
  leagues: [{
    leagueId: "scotland",
    country: "اسكتلندا",
    division: 1,
    expectedTeams: 12,
    clubs: Array.from({ length: 12 }, (_, clubIndex) => ({
      name: "Worker Test Club " + String(clubIndex + 1).padStart(2, "0"),
      aliases: [],
      leagueId: "scotland",
      country: "اسكتلندا",
      division: 1,
      players: Array.from({ length: 16 }, (_, playerIndex) => ({
        name: "Worker Test Player " + (clubIndex + 1) + "-" + (playerIndex + 1),
        position: playerIndex < 3 ? "حارس مرمى" : playerIndex < 8 ? "قلب دفاع" : playerIndex < 13 ? "وسط مهاجم" : "مهاجم",
        age: 19 + playerIndex % 11,
        number: playerIndex + 1,
        nationality: "SCO",
        isRealPlayer: true
      }))
    }))
  }]
};

const workerInstances = [];
const publications = [];

class FakeWorldWorker {
  static mismatchNextResponse = false;
  constructor(url) {
    this.url = url;
    this.messages = [];
    this.terminateCalls = 0;
    this.terminated = false;
    workerInstances.push(this);
  }
  postMessage(payload) {
    // Browser Worker.postMessage snapshots structured-cloneable inputs at send time.
    const message = JSON.parse(JSON.stringify(payload));
    const inputCount = Number(message.save && message.save.workerRoundTrips) || 0;
    this.messages.push({ id: message.id, command: message.command, inputCount });
    message.save.workerRoundTrips = inputCount + 1;
    const responseId = FakeWorldWorker.mismatchNextResponse ? "mismatch-" + message.id : message.id;
    FakeWorldWorker.mismatchNextResponse = false;
    const response = {
      id: responseId,
      ok: true,
      command: message.command,
      result: { command: message.command, sequence: inputCount + 1 },
      save: message.save
    };
    setImmediate(() => {
      if (!this.terminated && typeof this.onmessage === "function") this.onmessage({ data: response });
    });
  }
  terminate() {
    this.terminateCalls++;
    this.terminated = true;
  }
}

async function main() {
  const sandbox = {
    window: {
      LWFootballSquadData: fixture,
      Worker: FakeWorldWorker,
      LWStateStore: {
        publish(save, metadata) {
          publications.push({ name: save.name, source: metadata.source, command: metadata.command });
        }
      }
    },
    console
  };
  vm.createContext(sandbox);
  const dbSource = fs.readFileSync(path.join(root, "public", "football-world-db.js"), "utf8");
  const aiSource = fs.readFileSync(path.join(root, "public", "football-world-ai.js"), "utf8");
  new vm.Script(dbSource, { filename: "public/football-world-db.js" }).runInContext(sandbox);
  new vm.Script(aiSource, { filename: "public/football-world-ai.js" }).runInContext(sandbox);

  const ai = sandbox.window.LWWorldAI;
  assert.ok(ai, "world AI must initialize before its asynchronous worker bridge is used");
  assert.equal(typeof ai.dashboardAsync, "function");
  assert.equal(typeof ai.advanceToSeasonAsync, "function");
  assert.equal(typeof ai.completeSeasonAsync, "function");

  const save = { name: "career worker lifecycle test", season: 1, workerRoundTrips: 0 };
  // Launch concurrently to verify requests are serialized: each operation must
  // receive the latest save returned from the previous operation.
  const results = await Promise.all([
    ai.dashboardAsync(save, {}),
    ai.advanceToSeasonAsync(save, 2, {}),
    ai.completeSeasonAsync(save, 2, {})
  ]);

  assert.deepEqual(results.map(row => row.command), ["dashboard", "advanceToSeason", "completeSeason"]);
  assert.equal(workerInstances.length, 1, "dashboard and season jobs must reuse a single Worker instance");
  const worker = workerInstances[0];
  const workerSource = fs.readFileSync(path.join(root, "public", "football-world-worker.js"), "utf8");
  assert.ok(workerSource.includes('"./football-world-ai.js?v=13"'), "worker must load the cache-busted AI engine");
  assert.equal(worker.url, "./football-world-worker.js?v=5");
  assert.equal(worker.terminateCalls, 0, "successful requests must not terminate the shared worker");
  assert.deepEqual(worker.messages.map(row => row.command), ["dashboard", "advanceToSeason", "completeSeason"]);
  assert.deepEqual(worker.messages.map(row => row.inputCount), [0, 1, 2],
    "queued calls must send the latest save instead of stale snapshots");
  assert.equal(new Set(worker.messages.map(row => row.id)).size, 3, "each queued request must have its own correlation ID");
  assert.equal(save.workerRoundTrips, 3, "each worker response must be merged back into the live career save");
  assert.equal(publications.length, 3, "each successful worker update must publish the changed career state");
  assert.ok(publications.every(row => row.source === "world-worker"));
  assert.deepEqual(publications.map(row => row.command), ["dashboard", "advanceToSeason", "completeSeason"]);

  // A protocol mismatch must fail the worker instead of leaving the active request and queue stuck forever.
  FakeWorldWorker.mismatchNextResponse = true;
  const mismatchSave = { name: "worker response mismatch", season: 1, workerRoundTrips: 0 };
  const mismatchResult = await Promise.race([
    ai.dashboardAsync(mismatchSave, {}),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Mismatched worker response left the request pending")), 1500))
  ]);
  assert.ok(mismatchResult && typeof mismatchResult === "object", "a mismatched worker response should recover through the safe fallback");
  assert.equal(worker.terminateCalls, 1, "a protocol mismatch must terminate the corrupted worker");
  assert.equal(mismatchSave.workerRoundTrips, 0, "an uncorrelated worker snapshot must never overwrite the live save");
  assert.equal(publications.length, 3, "the rejected response must not publish uncorrelated state");

  console.log("PASS: world simulation reuses one worker, serializes saves, and recovers safely from response-ID mismatches.");
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
