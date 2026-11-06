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
const stateEvents = [];

class FakeWorldWorker {
  static mismatchNextResponse = false;
  static failNextResponse = false;
  static holdNextResponse = false;
  static heldResponse = null;
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
    const failed = FakeWorldWorker.failNextResponse;
    FakeWorldWorker.failNextResponse = false;
    const response = {
      id: responseId,
      ok: !failed,
      error: failed ? "simulated worker failure" : undefined,
      command: message.command,
      result: { command: message.command, sequence: inputCount + 1 },
      save: message.save
    };
    const deliver = () => {
      if (!this.terminated && typeof this.onmessage === "function") this.onmessage({ data: response });
    };
    if (FakeWorldWorker.holdNextResponse) {
      FakeWorldWorker.holdNextResponse = false;
      FakeWorldWorker.heldResponse = deliver;
    } else {
      setImmediate(deliver);
    }
  }
  terminate() {
    this.terminateCalls++;
    this.terminated = true;
  }
}

async function main() {
  let currentState = null;
  let storeRevision = 0;
  const stateStore = {
    getState() { return currentState; },
    getRevision() { return storeRevision; },
    publish(save, metadata) {
      currentState = save;
      storeRevision++;
      stateEvents.push({ state: save, source: metadata && metadata.source, command: metadata && metadata.command });
      if (metadata && metadata.source === "world-worker")
        publications.push({ name: save.name, source: metadata.source, command: metadata.command });
    }
  };
  const sandbox = {
    window: {
      LWFootballSquadData: fixture,
      Worker: FakeWorldWorker,
      LWStateStore: stateStore
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
  const pageSource = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const worldAiSource = fs.readFileSync(path.join(root, "public", "football-world-ai.js"), "utf8");
  const serviceWorkerSource = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
  const pageAiVersion = pageSource.match(/football-world-ai\.js\?v=(\d+)/);
  const workerAiVersion = workerSource.match(/football-world-ai\.js\?v=(\d+)/);
  const pageStoreVersion = pageSource.match(/career-state-store\.js\?v=(\d+)/);
  const workerStoreVersion = workerSource.match(/career-state-store\.js\?v=(\d+)/);
  const pageDbVersion = pageSource.match(/football-world-db\.js\?v=(\d+)/);
  const workerDbVersion = workerSource.match(/football-world-db\.js\?v=(\d+)/);
  const shellStoreVersion = serviceWorkerSource.match(/\.\/career-state-store\.js\?v=(\d+)/);
  const shellDbVersion = serviceWorkerSource.match(/\.\/football-world-db\.js\?v=(\d+)/);
  const appWorkerVersion = worldAiSource.match(/football-world-worker\.js\?v=(\d+)/);
  const shellWorkerVersion = serviceWorkerSource.match(/\.\/football-world-worker\.js\?v=(\d+)/);
  assert.ok(pageAiVersion && workerAiVersion, "page and worker must declare their world-AI asset versions");
  assert.equal(workerAiVersion[1], pageAiVersion[1], "main thread and worker must run the same world-AI engine version");
  assert.equal(pageAiVersion[1], "91", "the current page must load the expected world-AI asset");
  assert.ok(pageDbVersion && workerDbVersion && shellDbVersion, "page, worker, and offline shell must declare database asset versions");
  assert.equal(workerDbVersion[1], pageDbVersion[1], "main thread and worker must load the same world database version");
  assert.equal(shellDbVersion[1], pageDbVersion[1], "offline shell must precache the database version used by the page");
  assert.ok(pageStoreVersion && workerStoreVersion && shellStoreVersion,
    "page, worker, and offline shell must declare the shared state-store version");
  assert.equal(workerStoreVersion[1], pageStoreVersion[1],
    "main thread and worker must use the same canonical position normalizer version");
  assert.equal(shellStoreVersion[1], pageStoreVersion[1],
    "offline shell must precache the same state-store version used by page and worker");
  assert.ok(appWorkerVersion && shellWorkerVersion, "app and offline shell must declare the worker asset version");
  assert.equal(shellWorkerVersion[1], appWorkerVersion[1], "offline shell must precache the exact worker asset used by the app");
  assert.equal(worker.url, "./football-world-worker.js?v=" + appWorkerVersion[1]);
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

  // A worker response must never overwrite a purchase made while that worker was running.
  const staleSave = { name: "worker stale purchase regression", season: 1, money: 3000, xpMultiplier: false, workerRoundTrips: 0 };
  stateStore.publish(staleSave, { source: "test-seed" });
  FakeWorldWorker.holdNextResponse = true;
  const staleJob = ai.dashboardAsync(staleSave, {});
  assert.equal(typeof FakeWorldWorker.heldResponse, "function", "the worker response should be held for the race test");
  staleSave.money = 600;
  staleSave.xpMultiplier = true;
  stateStore.publish(staleSave, { source: "store-purchase" });
  const deliverStaleResponse = FakeWorldWorker.heldResponse;
  FakeWorldWorker.heldResponse = null;
  deliverStaleResponse();
  const staleResult = await staleJob;
  assert.ok(staleResult && typeof staleResult === "object", "a stale worker result should recover through the latest-state fallback");
  assert.equal(staleSave.money, 600, "a stale worker snapshot must not restore the pre-purchase balance");
  assert.equal(staleSave.xpMultiplier, true, "a stale worker snapshot must not remove newly purchased ownership");
  assert.equal(staleSave.workerRoundTrips, 0, "the stale worker payload must not be merged into the live save");
  assert.equal(publications.length, 3, "a stale worker response must not publish an old career snapshot");

  // A caller can retain an older object even while the shared store has moved on.
  // Matching revision numbers must not make that stale argument authoritative.
  const authoritativeSave = {
    name: "authoritative store state", season: 1, money: 600, xpMultiplier: true, workerRoundTrips: 0
  };
  const staleArgument = {
    name: "stale caller argument", season: 1, money: 3000, xpMultiplier: false, workerRoundTrips: 0
  };
  stateStore.publish(authoritativeSave, { source: "test-authoritative-state" });
  const authoritativeResult = await ai.dashboardAsync(staleArgument, {});
  assert.ok(authoritativeResult && typeof authoritativeResult === "object");
  assert.equal(stateStore.getState(), authoritativeSave,
    "a worker must publish against the current store object, not an old caller argument");
  assert.equal(authoritativeSave.workerRoundTrips, 1,
    "the worker must receive and update the authoritative career object");
  assert.equal(staleArgument.workerRoundTrips, 0,
    "a stale caller object must not be sent to the worker");
  assert.equal(authoritativeSave.money, 600);
  assert.equal(authoritativeSave.xpMultiplier, true);

  // Even a failed worker response after a purchase must fall back against the
  // latest store state rather than the older save object captured by the request.
  const failedRequestSave = {
    name: "worker failure before purchase", season: 1, money: 3000, xpMultiplier: false, workerRoundTrips: 0
  };
  const purchasedState = {
    name: "worker failure after purchase", season: 1, money: 600, xpMultiplier: true, workerRoundTrips: 0
  };
  stateStore.publish(failedRequestSave, { source: "test-worker-failure-start" });
  FakeWorldWorker.holdNextResponse = true;
  FakeWorldWorker.failNextResponse = true;
  const failedJob = ai.dashboardAsync(failedRequestSave, {});
  assert.equal(typeof FakeWorldWorker.heldResponse, "function",
    "the failing worker response should be held for the race test");
  stateStore.publish(purchasedState, { source: "store-purchase" });
  const deliverFailedResponse = FakeWorldWorker.heldResponse;
  FakeWorldWorker.heldResponse = null;
  deliverFailedResponse();
  const failedResult = await failedJob;
  assert.ok(failedResult && typeof failedResult === "object",
    "a failed worker request should recover using the current career state");
  assert.equal(stateStore.getState(), purchasedState,
    "worker fallback must not replace the current career object with an older request object");
  assert.equal(purchasedState.money, 600,
    "worker fallback must preserve the post-purchase balance");
  assert.equal(purchasedState.xpMultiplier, true,
    "worker fallback must preserve purchased ownership");
  assert.ok(purchasedState.worldSimulation && typeof purchasedState.worldSimulation === "object",
    "worker fallback must apply its world update to the latest career state");
  assert.equal(failedRequestSave.worldSimulation, undefined,
    "worker fallback must not mutate the stale request snapshot");
  assert.ok(stateEvents.some(row => row.source === "world-worker-fallback" && row.state === purchasedState),
    "the recovered current career state must be published to subscribers");

  console.log("PASS: world simulation reuses one worker, serializes saves, rejects stale worker snapshots, and recovers against the authoritative career after stale or failed responses.");
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
