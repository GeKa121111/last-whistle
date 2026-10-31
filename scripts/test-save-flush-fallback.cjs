"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const rootHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(rootHtml, publicHtml, "root and public app shells must stay synchronized");

const start = rootHtml.indexOf("async function flushQueuedSave(){");
const end = rootHtml.indexOf("\nfunction saveGame(", start);
assert.ok(start >= 0 && end > start, "the asynchronous queued-save flush must exist");
const flushSource = rootHtml.slice(start, end);

async function runFlush({ flush, queued = true, storageFails = false, initialFallback = null } = {}) {
  const writes = [];
  const removals = [];
  const warnings = [];
  let storedValue = initialFallback;
  const state = { name: "Save fallback regression", season: 4, money: 1250 };
  const sandbox = {
    state,
    saveQueued: queued,
    STORAGE_KEY: "lastWhistleCareer_v4",
    FALLBACK_STORAGE_PREFIX: "LWIDB1:",
    cancelQueuedSave() {},
    encodeStoredSave(value) { return JSON.stringify(value); },
    localStorage: {
      getItem(key) { return key === "lastWhistleCareer_v4" ? storedValue : null; },
      setItem(key, value) {
        if (storageFails) throw new Error("localStorage quota");
        writes.push({ key, value });
        storedValue = value;
      },
      removeItem(key) {
        removals.push(key);
        if (key === "lastWhistleCareer_v4") storedValue = null;
      }
    },
    window: { LWStateStore: { flush } },
    console: { warn(...args) { warnings.push(args); } },
    persistGame() { return true; }
  };
  vm.createContext(sandbox);
  new vm.Script(flushSource + "\nglobalThis.runQueuedFlush = flushQueuedSave;", {
    filename: "flushQueuedSave"
  }).runInContext(sandbox);
  const result = await sandbox.runQueuedFlush();
  return { result, saveQueued: sandbox.saveQueued, writes, removals, warnings, state, storedValue };
}

function selectLoadSource({ indexedSave, fallbackRaw, legacyRaw = null } = {}) {
  const loadStart = rootHtml.indexOf("function loadGame(){");
  const savedStart = rootHtml.indexOf("const saved=", loadStart);
  assert.ok(loadStart >= 0 && savedStart > loadStart, "loadGame save-source selection must exist");
  const prefix = rootHtml.slice(loadStart, savedStart);
  const source = prefix + "return { indexedSave, storageKey, raw };\n } catch(error) { return { error: String(error) }; }\n}";
  const sandbox = {
    STORAGE_KEY: "lastWhistleCareer_v4",
    FALLBACK_STORAGE_PREFIX: "LWIDB1:",
    LEGACY_STORAGE_KEYS: ["lastWhistleCareer_v3"],
    window: { LWStateStore: { getStartupSave: () => indexedSave || null } },
    localStorage: {
      getItem(key) {
        if (key === "lastWhistleCareer_v4") return fallbackRaw;
        if (key === "lastWhistleCareer_v3") return legacyRaw;
        return null;
      }
    },
    decodeStoredSave(value) { return value; },
    console: { warn() {} }
  };
  vm.createContext(sandbox);
  new vm.Script(source + "\nglobalThis.chooseLoadSource = loadGame;").runInContext(sandbox);
  return sandbox.chooseLoadSource();
}

(async () => {
  let successfulFlushCalls = 0;
  const successful = await runFlush({
    initialFallback: "LWIDB1:{\"name\":\"older fallback\"}",
    flush: async () => { successfulFlushCalls += 1; }
  });
  assert.equal(successful.result, true, "a successful IndexedDB flush should complete");
  assert.equal(successfulFlushCalls, 1, "the queued state must be flushed exactly once");
  assert.equal(successful.writes.length, 0, "a successful IndexedDB flush should not write a fallback copy");
  assert.deepEqual(successful.removals, ["lastWhistleCareer_v4"],
    "a successful IndexedDB flush must clear the prefixed fallback snapshot in place");
  assert.equal(successful.saveQueued, false, "a successful flush should clear the queued-save flag");

  const failed = await runFlush({
    flush: async () => { throw new Error("IndexedDB quota"); }
  });
  assert.equal(failed.result, true, "a failed IndexedDB flush should succeed through the fallback snapshot");
  assert.equal(failed.writes.length, 1, "a failed IndexedDB flush must persist one fallback snapshot");
  assert.equal(failed.writes[0].key, "lastWhistleCareer_v4",
    "the fallback must replace the legacy copy instead of duplicating a large save");
  assert.ok(failed.writes[0].value.startsWith("LWIDB1:"),
    "the fallback marker and payload must be written atomically in one localStorage value");
  assert.deepEqual(JSON.parse(failed.writes[0].value.slice("LWIDB1:".length)), failed.state,
    "the fallback must preserve the latest complete career state");
  assert.equal(failed.saveQueued, false, "a successful fallback should clear the queued-save flag");

  const fallbackFailed = await runFlush({
    flush: async () => { throw new Error("IndexedDB unavailable"); },
    storageFails: true
  });
  assert.equal(fallbackFailed.result, false, "both storage failures must be reported as an unsuccessful flush");
  assert.equal(fallbackFailed.saveQueued, true, "failed fallback storage must retain the queue for a later retry");

  let skippedFlushCalls = 0;
  const notQueued = await runFlush({
    queued: false,
    flush: async () => { skippedFlushCalls += 1; }
  });
  assert.equal(notQueued.result, true, "an empty queue should be a no-op");
  assert.equal(skippedFlushCalls, 0, "an empty queue must not create an unnecessary IndexedDB write");
  assert.equal(notQueued.writes.length, 0);

  const staleIndexed = { name: "older IndexedDB save", money: 10 };
  const newerFallback = "LWIDB1:" + JSON.stringify({ name: "newer fallback save", money: 999 });
  const selectedFallback = selectLoadSource({ indexedSave: staleIndexed, fallbackRaw: newerFallback });
  assert.equal(selectedFallback.indexedSave, null,
    "a valid fallback snapshot must override an older IndexedDB startup record");
  assert.equal(selectedFallback.storageKey, "LWIDB1:");
  assert.equal(selectedFallback.raw, newerFallback.slice("LWIDB1:".length),
    "the newest fallback payload must be decoded into the live career");

  const selectedIndexed = selectLoadSource({
    indexedSave: staleIndexed,
    fallbackRaw: "LWIDB1:corrupt fallback payload"
  });
  assert.deepEqual(selectedIndexed.indexedSave, staleIndexed,
    "an unreadable fallback must not displace a valid IndexedDB save");

  const selectedLegacy = selectLoadSource({
    indexedSave: null,
    fallbackRaw: "LWIDB1:corrupt fallback payload",
    legacyRaw: JSON.stringify({ name: "legacy backup" })
  });
  assert.equal(selectedLegacy.raw, JSON.stringify({ name: "legacy backup" }),
    "an unreadable fallback must leave the older legacy backup available");

  console.log("PASS: queued-save failures preserve and reload the newest career snapshot without duplicating large localStorage saves.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
