"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const marker = "async function init(){";
const start = html.indexOf(marker);
const end = html.indexOf("\ninit();", start);
assert.ok(start >= 0 && end > start, "the deployed application init function must exist");
assert.equal(html.indexOf(marker, start + marker.length), -1, "the app must expose only one init function");

const initSource = html.slice(start, end) + "\nglobalThis.__testInitialInit = init;";

async function runStartup({ loaded, hasIndexedSave, careerStarted = true }) {
  const calls = [];
  const published = [];
  const snapshots = [];
  let directStoreSaveCalls = 0;
  const state = {
    name: loaded ? "Migrated legacy career" : "New career",
    season: 1,
    schemaVersion: loaded ? 4 : 0,
    currentPage: "",
    careerStarted
  };
  const sandbox = {
    state,
    console: { warn() {} },
    window: {
      LWStateStore: {
        ready: async () => { calls.push("store-ready"); },
        getStartupSave: () => hasIndexedSave ? { state: { name: "indexed" } } : null,
        publish: (value, meta) => {
          calls.push("publish");
          published.push({
            source: meta && meta.source,
            careerNormalized: value.careerNormalized === true,
            leagueReady: value.leagueReady === true,
            schemaVersion: value.schemaVersion
          });
        },
        save: () => {
          directStoreSaveCalls++;
          throw new Error("init must not bypass the shared saveGame queue");
        }
      },
      LWCatalog: { load: async () => { calls.push("catalog-load"); } },
      LWCareer: {
        ensureState(value) {
          calls.push("career-normalize");
          value.careerNormalized = true;
        }
      }
    },
    loadGame() {
      calls.push("load-game");
      if (loaded) state.loadedFromStorage = true;
      return loaded;
    },
    createLeague() {
      calls.push("create-league");
      return [{ name: "Initial Test League", pts: 0 }];
    },
    log() { calls.push("log"); },
    ensureLeague() {
      calls.push("ensure-league");
      state.leagueReady = true;
      if (!Array.isArray(state.league)) state.league = [];
    },
    bind() { calls.push("bind"); },
    showPage(page) {
      calls.push("show-page");
      state.currentPage = page;
      state.pageRendered = true;
    },
    $(selector) {
      assert.equal(selector, "startScreen");
      return { classList: { add() { calls.push("show-start-screen"); } } };
    },
    saveGame(silent) {
      calls.push("save-game");
      assert.equal(silent, true, "initial persistence must be silent");
      state.schemaVersion = 10;
      snapshots.push(JSON.parse(JSON.stringify(state)));
      return true;
    }
  };
  vm.createContext(sandbox);
  new vm.Script(initSource, { filename: "deployed-index-init" }).runInContext(sandbox);
  await sandbox.__testInitialInit();

  assert.equal(directStoreSaveCalls, 0,
    "startup must not call LWStateStore.save directly and bypass the unified fallback queue");
  assert.equal(calls.filter(value => value === "save-game").length, 1,
    "startup must queue exactly one normalized initial save");
  assert.ok(calls.indexOf("career-normalize") < calls.indexOf("ensure-league"),
    "career migrations must run before league reconciliation");
  assert.ok(calls.indexOf("ensure-league") < calls.indexOf("publish"),
    "the state bus must not publish a partially initialized league");
  assert.ok(calls.indexOf("publish") < calls.indexOf("save-game"),
    "the normalized state must be published before it is queued for persistence");
  assert.ok(calls.indexOf("show-page") < calls.indexOf("save-game"),
    "the initial page state must be set before the first persisted snapshot");

  assert.equal(published.length, 1);
  assert.equal(published[0].careerNormalized, true);
  assert.equal(published[0].leagueReady, true);
  assert.equal(published[0].schemaVersion, 10);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].careerNormalized, true);
  assert.equal(snapshots[0].leagueReady, true);
  assert.equal(snapshots[0].schemaVersion, 10);
  assert.equal(snapshots[0].currentPage, "home");
  assert.equal(snapshots[0].pageRendered, true);
  assert.equal(published[0].source, loaded ? "load" : "new-career");
  if (!careerStarted) assert.ok(calls.includes("show-start-screen"));

  return { calls, state, snapshot: snapshots[0] };
}

(async () => {
  const fresh = await runStartup({ loaded: false, hasIndexedSave: false, careerStarted: false });
  assert.ok(fresh.calls.includes("create-league"),
    "a fresh career must build its first league before it is published or saved");

  const legacy = await runStartup({ loaded: true, hasIndexedSave: false });
  assert.ok(legacy.snapshot.loadedFromStorage,
    "a legacy localStorage career must be migrated through the shared initial-save path");

  const indexed = await runStartup({ loaded: true, hasIndexedSave: true });
  assert.ok(indexed.snapshot.loadedFromStorage,
    "an existing IndexedDB career must persist any in-memory schema normalization performed at startup");

  console.log("PASS: fresh, legacy, and IndexedDB startup states are normalized and league-ready before publishing and saving through the shared fallback queue.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
