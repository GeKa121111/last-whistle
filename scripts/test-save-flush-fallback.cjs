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

async function runFlush({ flush, queued = true, storageFails = false } = {}) {
  const writes = [];
  const warnings = [];
  const state = { name: "Save fallback regression", season: 4, money: 1250 };
  const sandbox = {
    state,
    saveQueued: queued,
    STORAGE_KEY: "lastWhistleSave",
    cancelQueuedSave() {},
    encodeStoredSave(value) { return JSON.stringify(value); },
    localStorage: {
      setItem(key, value) {
        if (storageFails) throw new Error("localStorage quota");
        writes.push({ key, value });
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
  return { result, saveQueued: sandbox.saveQueued, writes, warnings, state };
}

(async () => {
  let successfulFlushCalls = 0;
  const successful = await runFlush({
    flush: async () => { successfulFlushCalls += 1; }
  });
  assert.equal(successful.result, true, "a successful IndexedDB flush should complete");
  assert.equal(successfulFlushCalls, 1, "the queued state must be flushed exactly once");
  assert.equal(successful.writes.length, 0, "a successful IndexedDB flush should not write a fallback copy");
  assert.equal(successful.saveQueued, false, "a successful flush should clear the queued-save flag");

  const failed = await runFlush({
    flush: async () => { throw new Error("IndexedDB quota"); }
  });
  assert.equal(failed.result, true, "a failed IndexedDB flush should succeed through the legacy fallback");
  assert.equal(failed.writes.length, 1, "a failed IndexedDB flush must persist one fallback snapshot");
  assert.equal(failed.writes[0].key, "lastWhistleSave", "the fallback must use the canonical legacy save key");
  assert.deepEqual(JSON.parse(failed.writes[0].value), failed.state,
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

  console.log("PASS: queued saves fall back to localStorage when IndexedDB flush fails, and retain retry state if both stores fail.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
