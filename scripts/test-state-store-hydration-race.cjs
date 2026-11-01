"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "career-state-store.js"), "utf8");

function createHarness() {
  let openRequest = null;
  const readRequests = [];
  const writeTransactions = [];
  const writes = [];
  const database = {
    transaction(storeName, mode) {
      assert.equal(storeName, "saves");
      assert.ok(mode === "readonly" || mode === "readwrite");
      const transaction = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore(name) {
          assert.equal(name, "saves");
          return {
            get(id) {
              assert.equal(mode, "readonly");
              assert.equal(id, "career:default");
              const request = {};
              readRequests.push(request);
              return request;
            },
            put(record) {
              assert.equal(mode, "readwrite");
              writes.push(record);
              return {};
            }
          };
        }
      };
      if (mode === "readwrite") writeTransactions.push(transaction);
      return transaction;
    }
  };
  const window = {
    document: {},
    indexedDB: {
      open(name, version) {
        assert.equal(name, "last-whistle-state");
        assert.equal(version, 1);
        openRequest = {};
        return openRequest;
      }
    },
    console
  };
  const sandbox = { window, Promise, Date, console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "career-state-store.js" });
  return {
    store: window.LWStateStore,
    writes,
    writeTransactions,
    async resolveStartupRead(record) {
      assert.ok(openRequest && typeof openRequest.onsuccess === "function",
        "the asynchronous IndexedDB open must still be pending");
      openRequest.result = database;
      openRequest.onsuccess();
      await new Promise(resolve => setImmediate(resolve));
      const startupRead = readRequests[0];
      assert.ok(startupRead && typeof startupRead.onsuccess === "function",
        "the startup save read must be pending after the database opens");
      startupRead.result = record;
      startupRead.onsuccess();
      return window.LWStateStore.ready();
    },
    async waitForRead(index) {
      await new Promise(resolve => setImmediate(resolve));
      const request = readRequests[index];
      assert.ok(request && typeof request.onsuccess === "function",
        "the requested IndexedDB read transaction must be pending");
      return request;
    },
    async waitForWrite(index = 0) {
      await new Promise(resolve => setImmediate(resolve));
      const transaction = writeTransactions[index];
      assert.ok(transaction && typeof transaction.oncomplete === "function",
        "the IndexedDB write transaction must be pending");
      return transaction;
    }
  };
}

(async function main() {
  const previousSave = { name: "Previous IndexedDB Career", money: 333 };
  const normalStartup = createHarness();
  const normalReady = await normalStartup.resolveStartupRead({
    id: "career:default", state: previousSave
  });
  assert.strictEqual(normalStartup.store.getState(), previousSave,
    "without a newer publish, normal startup must hydrate the IndexedDB save");
  assert.strictEqual(normalStartup.store.getStartupSave(), previousSave);
  assert.equal(normalReady.hasSave, true);

  const racedStartup = createHarness();
  const importedCareer = { name: "Imported Career", money: 2500 };
  racedStartup.store.publish(importedCareer, { source: "import" });
  const racedReady = await racedStartup.resolveStartupRead({
    id: "career:default", state: previousSave
  });
  assert.strictEqual(racedStartup.store.getState(), importedCareer,
    "a late IndexedDB startup read must never overwrite a career imported while it was pending");
  assert.strictEqual(racedStartup.store.getStartupSave(), importedCareer,
    "the imported career must remain the startup save after the stale read completes");
  assert.equal(racedReady.hasSave, true);

  const normalWrite = createHarness();
  await normalWrite.resolveStartupRead(null);
  const savedCareer = { name: "Persisted Career", money: 1800 };
  const normalSavePromise = normalWrite.store.save(savedCareer);
  const normalWriteTransaction = await normalWrite.waitForWrite();
  assert.equal(normalWrite.writes.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(normalWrite.writes[0].state)), savedCareer);
  normalWriteTransaction.oncomplete();
  await normalSavePromise;
  assert.equal(JSON.stringify(normalWrite.store.getStartupSave()), JSON.stringify(savedCareer),
    "a successful current save must still become the startup save");

  const delayedWrite = createHarness();
  await delayedWrite.resolveStartupRead(null);
  const olderCareer = { name: "Older Save In Flight", money: 700 };
  const delayedSavePromise = delayedWrite.store.save(olderCareer);
  const delayedTransaction = await delayedWrite.waitForWrite();
  const newerImportedCareer = { name: "Newer Imported Career", money: 4200 };
  delayedWrite.store.publish(newerImportedCareer, { source: "import" });
  delayedTransaction.oncomplete();
  await delayedSavePromise;
  assert.strictEqual(delayedWrite.store.getState(), newerImportedCareer,
    "a late save completion must not replace the newer live imported career");
  assert.strictEqual(delayedWrite.store.getStartupSave(), newerImportedCareer,
    "a late IndexedDB write must not overwrite the newer imported startup save");

  const normalLoad = createHarness();
  await normalLoad.resolveStartupRead(null);
  const loadedCareer = { name: "Explicitly Loaded Career", money: 1300 };
  const normalLoadPromise = normalLoad.store.load();
  const normalLoadRequest = await normalLoad.waitForRead(1);
  normalLoadRequest.result = { id: "career:default", state: loadedCareer };
  normalLoadRequest.onsuccess();
  const normalLoadResult = await normalLoadPromise;
  assert.equal(JSON.stringify(normalLoadResult), JSON.stringify(loadedCareer));
  assert.strictEqual(normalLoad.store.getState(), normalLoadResult,
    "a current explicit default-slot load must still publish its loaded career");
  assert.strictEqual(normalLoad.store.getStartupSave(), normalLoadResult);

  const delayedLoad = createHarness();
  await delayedLoad.resolveStartupRead(null);
  const staleLoadedCareer = { name: "Older Saved Career", money: 900 };
  const delayedLoadPromise = delayedLoad.store.load();
  const delayedLoadRequest = await delayedLoad.waitForRead(1);
  const newerImportedDuringLoad = { name: "Imported During Explicit Load", money: 4600 };
  delayedLoad.store.publish(newerImportedDuringLoad, { source: "import" });
  delayedLoadRequest.result = { id: "career:default", state: staleLoadedCareer };
  delayedLoadRequest.onsuccess();
  const delayedLoadResult = await delayedLoadPromise;
  assert.equal(JSON.stringify(delayedLoadResult), JSON.stringify(staleLoadedCareer),
    "load must still return the requested saved-slot payload to its caller");
  assert.strictEqual(delayedLoad.store.getState(), newerImportedDuringLoad,
    "a delayed explicit load must not replace a newer imported live career");
  assert.strictEqual(delayedLoad.store.getStartupSave(), newerImportedDuringLoad,
    "a delayed explicit load must not replace the newer startup save");

  console.log("PASS: delayed hydration, save completion, and explicit load cannot overwrite a newer career; normal startup/save/load remain intact.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
