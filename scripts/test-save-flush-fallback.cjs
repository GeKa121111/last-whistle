"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const rootHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(rootHtml, publicHtml, "root and public app shells must stay synchronized");

const start = rootHtml.indexOf("function clearFallbackAfterIndexedDBSave(");
const end = rootHtml.indexOf("\nif(!window.__lwSaveFlushInstalled)", start);
assert.ok(start >= 0 && end > start, "the IndexedDB save and queued-flush pipeline must exist");
const saveSource = rootHtml.slice(start, end);

function makeSandbox({ state, queued = true, flush, save, storageFails = false, removeFails = false, initialFallback = null } = {}) {
  const writes = [];
  const removals = [];
  const warnings = [];
  let storedValue = initialFallback;
  const sandbox = {
    state: state || { name: "Save fallback regression", season: 4, money: 1250 },
    saveQueued: queued,
    saveRevision: 1,
    saveFlushPromise: null,
    saveWriteInFlight: 0,
    STORAGE_KEY: "lastWhistleCareer_v4",
    FALLBACK_STORAGE_PREFIX: "LWIDB1:",
    cancelQueuedSave() {},
    structuredCloneSafe(value) { return JSON.parse(JSON.stringify(value)); },
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
        if (removeFails) throw new Error("localStorage remove blocked");
        if (key === "lastWhistleCareer_v4") storedValue = null;
      }
    },
    window: {
      LWStateStore: {
        flush: flush || (async () => {}),
        save: save || (async () => {}),
        publish() {}
      }
    },
    console: { warn(...args) { warnings.push(args); } },
    persistGame() { return true; }
  };
  vm.createContext(sandbox);
  new vm.Script(saveSource + "\nglobalThis.runQueuedFlush = flushQueuedSave; globalThis.runPersistGame = persistGame;", {
    filename: "career-save-pipeline"
  }).runInContext(sandbox);
  return {
    sandbox,
    writes,
    removals,
    warnings,
    get storedValue() { return storedValue; },
    set storedValue(value) { storedValue = value; }
  };
}

async function runFlush(options = {}) {
  const harness = makeSandbox(options);
  const result = await harness.sandbox.runQueuedFlush();
  return {
    result,
    saveQueued: harness.sandbox.saveQueued,
    writes: harness.writes,
    removals: harness.removals,
    warnings: harness.warnings,
    state: harness.sandbox.state,
    storedValue: harness.storedValue
  };
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
    flush: async snapshot => { successfulFlushCalls += 1; assert.equal(snapshot.money, 1250); }
  });
  assert.equal(successful.result, true, "a successful IndexedDB flush should complete");
  assert.equal(successfulFlushCalls, 1, "the queued state must be flushed exactly once");
  assert.equal(successful.writes.length, 0, "a successful IndexedDB flush should not write a fallback copy");
  assert.deepEqual(successful.removals, ["lastWhistleCareer_v4"],
    "a successful IndexedDB flush must clear the prefixed fallback snapshot in place");
  assert.equal(successful.storedValue, null, "a completed flush should leave no stale fallback");
  assert.equal(successful.saveQueued, false, "a successful flush should clear the queued-save flag");

  const failed = await runFlush({
    flush: async () => { throw new Error("IndexedDB quota"); }
  });
  assert.equal(failed.result, true, "a failed IndexedDB flush should succeed through the fallback snapshot");
  assert.equal(failed.writes.length, 1, "a failed IndexedDB flush must persist one fallback snapshot");
  assert.equal(failed.writes[0].key, "lastWhistleCareer_v4");
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

  const cleanupBlocked = await runFlush({
    initialFallback: "LWIDB1:{\"name\":\"stale fallback\",\"money\":10}",
    removeFails: true,
    flush: async () => {}
  });
  assert.equal(cleanupBlocked.result, true, "an IndexedDB success remains successful when fallback cleanup is blocked");
  assert.ok(cleanupBlocked.storedValue.startsWith("LWIDB1:"),
    "a blocked remove must leave a readable fallback rather than an empty key");
  assert.deepEqual(JSON.parse(cleanupBlocked.storedValue.slice("LWIDB1:".length)), cleanupBlocked.state,
    "if stale fallback cleanup is blocked, overwrite it with the exact snapshot just committed to IndexedDB");

  const notQueued = await runFlush({
    queued: false,
    flush: async () => { throw new Error("must not be called"); }
  });
  assert.equal(notQueued.result, true, "an empty queue should be a no-op");
  assert.equal(notQueued.writes.length, 0);

  const staleIndexed = { name: "older IndexedDB save", money: 10 };
  const newerFallback = "LWIDB1:" + JSON.stringify({ name: "newer fallback save", money: 999 });
  const selectedFallback = selectLoadSource({ indexedSave: staleIndexed, fallbackRaw: newerFallback });
  assert.equal(selectedFallback.indexedSave, null);
  assert.equal(selectedFallback.storageKey, "LWIDB1:");
  assert.equal(selectedFallback.raw, newerFallback.slice("LWIDB1:".length));

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
  assert.equal(selectedLegacy.raw, JSON.stringify({ name: "legacy backup" }));

  let releaseFirst;
  const firstGate = new Promise(resolve => { releaseFirst = resolve; });
  const flushSnapshots = [];
  const concurrent = makeSandbox({
    state: { name: "Save concurrency regression", season: 4, money: 1250 },
    queued: true,
    initialFallback: "LWIDB1:{\"name\":\"old fallback\",\"money\":10}",
    flush: async snapshot => {
      flushSnapshots.push(JSON.parse(JSON.stringify(snapshot)));
      if (flushSnapshots.length === 1) await firstGate;
    }
  });
  const firstFlush = concurrent.sandbox.runQueuedFlush();
  await Promise.resolve();
  assert.equal(flushSnapshots.length, 1, "the first save should enter IndexedDB before the second save is queued");

  concurrent.sandbox.state.money = 999;
  concurrent.sandbox.saveRevision += 1;
  concurrent.sandbox.saveQueued = true;
  const pageHideFlush = concurrent.sandbox.runQueuedFlush({ backupFirst: true });
  assert.deepEqual(JSON.parse(concurrent.storedValue.slice("LWIDB1:".length)),
    concurrent.sandbox.state, "pagehide must synchronously preserve the newest state while an older IndexedDB write is pending");

  releaseFirst();
  const [firstResult, pageHideResult] = await Promise.all([firstFlush, pageHideFlush]);
  assert.equal(firstResult, true);
  assert.equal(pageHideResult, true);
  assert.equal(flushSnapshots.length, 2, "a save queued during an in-flight write must be flushed afterward");
  assert.equal(flushSnapshots[0].money, 1250);
  assert.equal(flushSnapshots[1].money, 999, "the follow-up flush must persist the newer state, not the stale snapshot");
  assert.equal(concurrent.sandbox.saveQueued, false);
  assert.equal(concurrent.storedValue, null, "the fallback may be removed only after the newer snapshot is committed");

  let releaseDirectSave;
  const directSaveGate = new Promise(resolve => { releaseDirectSave = resolve; });
  const direct = makeSandbox({
    state: { name: "Direct save race", season: 2, money: 100 },
    queued: false,
    save: async () => directSaveGate
  });
  assert.equal(direct.sandbox.runPersistGame(true), true, "direct IndexedDB save should start");
  assert.equal(direct.sandbox.saveWriteInFlight, 1);
  direct.sandbox.state.money = 777;
  direct.sandbox.saveRevision += 1;
  direct.storedValue = "LWIDB1:" + JSON.stringify(direct.sandbox.state);
  releaseDirectSave();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(direct.sandbox.saveWriteInFlight, 0);
  assert.deepEqual(JSON.parse(direct.storedValue.slice("LWIDB1:".length)), direct.sandbox.state,
    "an older direct-save completion must never remove a newer fallback snapshot");

  assert.ok(rootHtml.includes('window.addEventListener("pagehide",()=>flushQueuedSave({backupFirst:true}));'),
    "pagehide must request a synchronous fallback snapshot before awaiting IndexedDB");
  assert.ok(rootHtml.includes('document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flushQueuedSave({backupFirst:true});});'),
    "backgrounding the app must also preserve the latest state before an asynchronous flush");

  console.log("PASS: save flushes are ordered, page-hide backups are synchronous, and stale fallbacks cannot overwrite newer career data.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
