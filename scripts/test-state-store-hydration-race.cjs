"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "career-state-store.js"), "utf8");

function createHarness() {
  let openRequest = null;
  let readRequest = null;
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
              readRequest = {};
              return readRequest;
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
      assert.ok(readRequest && typeof readRequest.onsuccess === "function",
        "the startup save read must be pending after the database opens");
      readRequest.result = record;
      readRequest.onsuccess();
      return window.LWStateStore.ready();
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

  console.log("PASS: delayed hydration and delayed save completion cannot overwrite a newer imported career; normal startup and save remain intact.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
