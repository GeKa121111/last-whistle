"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "career-state-store.js"), "utf8");

function createHarness() {
  let openRequest = null;
  let readRequest = null;
  const database = {
    transaction(storeName, mode) {
      assert.equal(storeName, "saves");
      assert.equal(mode, "readonly");
      return {
        objectStore(name) {
          assert.equal(name, "saves");
          return {
            get(id) {
              assert.equal(id, "career:default");
              readRequest = {};
              return readRequest;
            }
          };
        }
      };
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

  console.log("PASS: delayed IndexedDB hydration cannot overwrite an imported career, while normal startup hydration remains intact.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
