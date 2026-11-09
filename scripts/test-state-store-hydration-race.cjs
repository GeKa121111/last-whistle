"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "career-state-store.js"), "utf8");

function createHarness() {
  let openRequest = null;
  const readRequests = [];
  const listRequests = [];
  const writeTransactions = [];
  const writes = [];
  const committedWrites = [];
  const database = {
    transaction(storeName, mode) {
      assert.equal(storeName, "saves");
      assert.ok(mode === "readonly" || mode === "readwrite");
      const transaction = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        aborted: false,
        pendingRecord: null,
        abort() {
          if (this.aborted) return;
          this.aborted = true;
          Promise.resolve().then(() => {
            if (typeof this.onabort === "function") this.onabort();
          });
        },
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
            getAll() {
              assert.equal(mode, "readonly");
              const request = {};
              listRequests.push(request);
              return request;
            },
            put(record) {
              assert.equal(mode, "readwrite");
              writes.push(record);
              transaction.pendingRecord = record;
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
    committedWrites,
    writeTransactions,
    listRequests,
    completeWrite(index = 0) {
      const transaction = writeTransactions[index];
      if (!transaction || transaction.aborted) return false;
      if (transaction.pendingRecord) committedWrites.push(transaction.pendingRecord);
      if (typeof transaction.oncomplete === "function") transaction.oncomplete();
      return true;
    },
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
  assert.equal(normalWrite.completeWrite(), true);
  await normalSavePromise;
  assert.equal(normalWrite.committedWrites.length, 1,
    "a normal current save must commit its IndexedDB record");
  assert.equal(JSON.stringify(normalWrite.store.getStartupSave()), JSON.stringify(savedCareer),
    "a successful current save must still become the startup save");

  const malformedMetadata = createHarness();
  await malformedMetadata.resolveStartupRead(null);
  const hostileMetadataValue = JSON.parse('{"toString":1,"valueOf":1}');
  const malformedMetadataCareer = {
    name: hostileMetadataValue, schemaVersion: hostileMetadataValue,
    season: hostileMetadataValue, money: 1800
  };
  let malformedMetadataSave;
  assert.doesNotThrow(() => {
    malformedMetadataSave = malformedMetadata.store.save(malformedMetadataCareer);
  }, "hostile JSON-compatible schema, season, and name metadata must not throw during save setup");
  await malformedMetadata.waitForWrite();
  assert.equal(malformedMetadata.writes[0].schemaVersion, 10,
    "a malformed saved schema version must use the safe metadata default");
  assert.equal(malformedMetadata.writes[0].season, 1,
    "a malformed saved season must use the safe metadata default");
  assert.equal(malformedMetadata.writes[0].playerName, "لاعب",
    "an object-valued legacy player name must not be coerced into save metadata");
  assert.equal(malformedMetadata.writes[0].label, "المسيرة الرئيسية",
    "an object-valued legacy player name must not break the save-slot label");
  assert.deepEqual(JSON.parse(JSON.stringify(malformedMetadata.writes[0].state)), malformedMetadataCareer,
    "sanitizing IndexedDB metadata must preserve the original career payload without deleting malformed legacy fields");
  assert.equal(malformedMetadata.completeWrite(), true);
  await malformedMetadataSave;

  const numericStringMetadata = createHarness();
  await numericStringMetadata.resolveStartupRead(null);
  const numericStringCareer = { name: "Legacy Numeric Save", schemaVersion: "9", season: "4", money: 900 };
  const numericStringSave = numericStringMetadata.store.save(numericStringCareer);
  await numericStringMetadata.waitForWrite();
  assert.equal(numericStringMetadata.writes[0].schemaVersion, 9,
    "valid numeric-string schema versions from older saves must remain supported");
  assert.equal(numericStringMetadata.writes[0].season, 4,
    "valid numeric-string seasons from older saves must remain supported");
  assert.equal(numericStringMetadata.writes[0].playerName, "Legacy Numeric Save");
  assert.equal(numericStringMetadata.completeWrite(), true);
  await numericStringSave;

  const hostileSlotId = JSON.parse('{"toString":1,"valueOf":1}');
  const invalidSlotSave = createHarness();
  const revisionBeforeInvalidSlot = invalidSlotSave.store.getRevision();
  let invalidSlotSavePromise;
  assert.doesNotThrow(() => {
    invalidSlotSavePromise = invalidSlotSave.store.save(
      { name: "Must not be written to an invalid slot" }, { slotId: hostileSlotId });
  }, "invalid JSON slot identifiers must be rejected asynchronously without coercion");
  await assert.rejects(invalidSlotSavePromise, /Invalid save-slot id/,
    "an object-valued slot id must not be converted into a string key");
  assert.equal(invalidSlotSave.writes.length, 0,
    "an invalid slot id must not create or overwrite any IndexedDB save record");
  assert.equal(invalidSlotSave.store.getRevision(), revisionBeforeInvalidSlot,
    "rejecting an invalid slot id must not publish or mutate the active career");

  const invalidSlotLoad = createHarness();
  assert.equal(await invalidSlotLoad.store.load(hostileSlotId), null,
    "loading with an invalid slot id must return no record without coercion");
  await assert.rejects(invalidSlotLoad.store.deleteSave(hostileSlotId), /valid save-slot id/,
    "deleting with an invalid slot id must reject before issuing an IndexedDB request");

  const numericSlot = createHarness();
  await numericSlot.resolveStartupRead(null);
  const numericSlotSave = numericSlot.store.save(
    { name: "Numeric legacy slot" }, { slotId: 7 });
  await numericSlot.waitForWrite();
  assert.equal(numericSlot.writes[0].id, "7",
    "finite numeric legacy slot ids must remain compatible as string IndexedDB keys");
  assert.equal(numericSlot.completeWrite(), true);
  await numericSlotSave;

  const flushRace = createHarness();
  const staleFlushCareer = { name: "Career queued before import", money: 700 };
  const flushRacePromise = flushRace.store.flush(staleFlushCareer);
  const latestImportedCareer = { name: "Career imported while IndexedDB opens", money: 4700 };
  flushRace.store.publish(latestImportedCareer, { source: "import" });
  await flushRace.resolveStartupRead(null);
  const retryFlushTransaction = await flushRace.waitForWrite();
  assert.equal(flushRace.writes.length, 1,
    "a superseded flush must retry once instead of persisting the stale pre-import snapshot");
  assert.deepEqual(JSON.parse(JSON.stringify(flushRace.writes[0].state)), latestImportedCareer,
    "a flush superseded during IndexedDB startup must persist the newest published career");
  assert.equal(flushRace.completeWrite(), true);
  assert.equal(await flushRacePromise, true,
    "a superseded flush should report success only after the latest career is committed");
  assert.equal(flushRace.committedWrites.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(flushRace.committedWrites[0].state)), latestImportedCareer,
    "the committed default-slot record must be the imported career, never the stale queued state");
  assert.deepEqual(JSON.parse(JSON.stringify(flushRace.store.getStartupSave())), latestImportedCareer,
    "the successful retry must become the startup save");

  const concurrentFlush = createHarness();
  await concurrentFlush.resolveStartupRead(null);
  const concurrentCareer = { name: "Purchase while a flush is pending", money: 3000, xpMultiplier: false };
  concurrentFlush.store.publish(concurrentCareer, { source: "import" });
  const firstFlush = concurrentFlush.store.flush(concurrentCareer);
  await concurrentFlush.waitForWrite(0);
  concurrentCareer.money = 600;
  concurrentCareer.xpMultiplier = true;
  concurrentFlush.store.markDirty(concurrentCareer);
  const overlappingFlush = concurrentFlush.store.flush({
    name: "Detached stale caller", money: 3000, xpMultiplier: false
  });
  assert.strictEqual(overlappingFlush, firstFlush,
    "overlapping default-slot flushes must share one in-flight writer instead of superseding each other");
  assert.equal(concurrentFlush.writeTransactions[0].aborted, true,
    "a mutation during the first write must abort its stale snapshot");
  await concurrentFlush.waitForWrite(1);
  assert.equal(concurrentFlush.writes.length, 2,
    "the single flush queue must retry once with the latest live career");
  assert.deepEqual(JSON.parse(JSON.stringify(concurrentFlush.writes[1].state)), concurrentCareer,
    "the retry must persist the post-purchase balance and ownership flag");
  assert.equal(concurrentFlush.completeWrite(1), true);
  assert.equal(await firstFlush, true);
  assert.equal(await overlappingFlush, true);
  assert.equal(concurrentFlush.committedWrites.length, 1,
    "only the latest career snapshot may commit after concurrent flush requests");
  assert.deepEqual(JSON.parse(JSON.stringify(concurrentFlush.committedWrites[0].state)), concurrentCareer);

  const delayedWrite = createHarness();
  await delayedWrite.resolveStartupRead(null);
  const olderCareer = { name: "Older Save In Flight", money: 700 };
  const delayedSavePromise = delayedWrite.store.save(olderCareer);
  const delayedTransaction = await delayedWrite.waitForWrite();
  const newerImportedCareer = { name: "Newer Imported Career", money: 4200 };
  delayedWrite.store.publish(newerImportedCareer, { source: "import" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(delayedTransaction.aborted, true,
    "a newer import must abort the in-flight default-slot IndexedDB transaction");
  await delayedSavePromise;
  assert.equal(delayedWrite.committedWrites.length, 0,
    "a superseded save must never commit its stale IndexedDB snapshot");
  assert.strictEqual(delayedWrite.store.getState(), newerImportedCareer,
    "a late save completion must not replace the newer live imported career");
  assert.strictEqual(delayedWrite.store.getStartupSave(), newerImportedCareer,
    "a late IndexedDB write must not overwrite the newer imported startup save");

  const loadAfterSave = createHarness();
  await loadAfterSave.resolveStartupRead(null);
  const preLoadCareer = { name: "Save In Flight Before Explicit Load", money: 810 };
  const preLoadSavePromise = loadAfterSave.store.save(preLoadCareer);
  const preLoadTransaction = await loadAfterSave.waitForWrite();
  const selectedCareer = { name: "Career Selected From IndexedDB", money: 5100 };
  const explicitLoadPromise = loadAfterSave.store.load();
  const explicitLoadRequest = await loadAfterSave.waitForRead(1);
  explicitLoadRequest.result = { id: "career:default", state: selectedCareer };
  explicitLoadRequest.onsuccess();
  const explicitLoadResult = await explicitLoadPromise;
  await preLoadSavePromise;
  assert.equal(preLoadTransaction.aborted, true,
    "loading the default slot must abort an older in-flight save before it can overwrite the selected record");
  assert.equal(loadAfterSave.committedWrites.length, 0,
    "the stale pre-load career must not be committed after the explicit load");
  assert.strictEqual(loadAfterSave.store.getState(), explicitLoadResult,
    "the explicitly selected IndexedDB career must remain the live state");
  assert.strictEqual(loadAfterSave.store.getStartupSave(), explicitLoadResult,
    "the explicitly selected IndexedDB career must remain the startup save");

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

  const queuedMutation = createHarness();
  await queuedMutation.resolveStartupRead(null);
  const originalQueuedState = { name: "Career before queued mutation", money: 700, age: 17 };
  const olderQueuedWrite = queuedMutation.store.save(originalQueuedState);
  const olderQueuedTransaction = await queuedMutation.waitForWrite();
  const observedEvents = [];
  queuedMutation.store.subscribe(event => observedEvents.push(event));
  const editedQueuedState = { name: "Career after queued mutation", money: 700, age: 18 };
  const revisionBeforeDirty = queuedMutation.store.getRevision();
  const dirtyRevision = queuedMutation.store.markDirty(editedQueuedState);
  assert.equal(dirtyRevision, revisionBeforeDirty + 1,
    "markDirty must advance the shared revision synchronously");
  assert.strictEqual(queuedMutation.store.getState(), editedQueuedState,
    "markDirty must make the edited in-memory career the authoritative state");
  assert.equal(olderQueuedTransaction.aborted, true,
    "markDirty must abort an older IndexedDB write before it can commit stale career data");
  assert.equal(observedEvents.length, 0,
    "markDirty must not notify render subscribers before the queued durable save");
  await olderQueuedWrite;
  assert.equal(queuedMutation.committedWrites.length, 0,
    "the older queued snapshot must never commit after markDirty");
  const currentFlush = queuedMutation.store.flush(editedQueuedState);
  const currentTransaction = await queuedMutation.waitForWrite(1);
  assert.deepEqual(JSON.parse(JSON.stringify(queuedMutation.writes[1].state)), editedQueuedState,
    "the eventual flush must persist the edited authoritative career");
  assert.equal(queuedMutation.completeWrite(1), true);
  assert.equal(await currentFlush, true);
  assert.deepEqual(JSON.parse(JSON.stringify(queuedMutation.committedWrites[0].state)), editedQueuedState);

  const completionBoundary = createHarness();
  await completionBoundary.resolveStartupRead(null);
  const boundaryCareer = { name: "Career updated at flush completion", money: 1200 };
  completionBoundary.store.publish(boundaryCareer, { source: "import" });
  const boundaryFlush = completionBoundary.store.flush(boundaryCareer);
  await completionBoundary.waitForWrite(0);
  let boundaryOverlap = null;
  completionBoundary.completeWrite(0);
  queueMicrotask(() => {
    boundaryCareer.money = 975;
    completionBoundary.store.markDirty(boundaryCareer);
    boundaryOverlap = completionBoundary.store.flush({ name: "Detached stale caller", money: 1200 });
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(boundaryOverlap, boundaryFlush,
    "a flush requested between transaction completion and writer release must join the same durable operation");
  await completionBoundary.waitForWrite(1);
  assert.equal(completionBoundary.writes.length, 2,
    "a completion-boundary flush request must trigger a follow-up write");
  assert.deepEqual(JSON.parse(JSON.stringify(completionBoundary.writes[1].state)), boundaryCareer,
    "the follow-up write must persist the newest live career, not the detached caller snapshot");
  assert.equal(completionBoundary.completeWrite(1), true);
  assert.equal(await boundaryFlush, true,
    "the shared flush promise must remain pending until the completion-boundary update is committed");
  assert.equal(await boundaryOverlap, true);
  assert.deepEqual(JSON.parse(JSON.stringify(completionBoundary.committedWrites.at(-1).state)), boundaryCareer,
    "the final committed default-slot record must contain the newest career state");

  const listedSaves = createHarness();
  await listedSaves.resolveStartupRead(null);
  const hostileListMetadata = JSON.parse('{"toString":1,"valueOf":1}');
  const legacyRows = [
    { id: "older", label: "Older career", updatedAt: "2026-01-01T00:00:00.000Z", season: "2", playerName: "Older player", schemaVersion: "9" },
    { id: "newer", label: "Newer career", updatedAt: "2026-02-01T00:00:00.000Z", season: 3, playerName: "Newer player", schemaVersion: 10 },
    { id: "numeric-date", label: "Numeric date", updatedAt: Date.UTC(2026, 2, 1), season: 4, playerName: "Numeric player", schemaVersion: 10 },
    { id: "malformed-metadata", label: hostileListMetadata, updatedAt: hostileListMetadata, season: hostileListMetadata, playerName: hostileListMetadata, schemaVersion: hostileListMetadata },
    { id: hostileListMetadata, label: "Invalid identifier", updatedAt: "2026-03-02T00:00:00.000Z", season: 1, playerName: "Invalid", schemaVersion: 10 },
    null
  ];
  const listPromise = listedSaves.store.listSaves();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(listedSaves.listRequests.length, 1,
    "listing saved careers must issue one readonly getAll request");
  listedSaves.listRequests[0].result = legacyRows;
  listedSaves.listRequests[0].onsuccess();
  const safeRows = await listPromise;
  assert.deepEqual(safeRows.map(row => row.id), ["numeric-date", "newer", "older", "malformed-metadata"],
    "valid save slots must sort newest-first and malformed dates must sort last without throwing");
  assert.equal(safeRows[0].updatedAt, new Date(Date.UTC(2026, 2, 1)).toISOString(),
    "numeric legacy timestamps must remain readable as ISO dates");
  assert.equal(safeRows[3].label, "مسيرة محفوظة",
    "object-valued legacy labels must receive a safe display fallback");
  assert.equal(safeRows[3].playerName, "لاعب",
    "object-valued legacy player names must receive a safe display fallback");
  assert.equal(safeRows[3].updatedAt, "",
    "object-valued legacy timestamps must not be coerced into strings");
  assert.equal(safeRows[3].season, null);
  assert.equal(safeRows[3].schemaVersion, null);
  assert.equal(legacyRows.length, 6,
    "display normalization must not delete malformed or legacy records from IndexedDB results");
  assert.equal(legacyRows[3].updatedAt, hostileListMetadata,
    "display normalization must not mutate the original malformed record");


  const invalidArrayStartup = createHarness();
  const invalidArrayReady = await invalidArrayStartup.resolveStartupRead({
    id: "career:default", state: []
  });
  assert.equal(invalidArrayReady.hasSave, false,
    "startup hydration must ignore array-shaped career payloads instead of publishing them as a live save");
  assert.equal(invalidArrayStartup.store.getState(), null);
  assert.equal(invalidArrayStartup.store.getStartupSave(), null);

  const invalidArrayMutation = createHarness();
  const authoritativeCareer = { name: "Authoritative object career", money: 600 };
  invalidArrayMutation.store.publish(authoritativeCareer, { source: "import" });
  const revisionBeforeInvalidMutation = invalidArrayMutation.store.getRevision();
  assert.equal(invalidArrayMutation.store.publish([], { source: "import" }), revisionBeforeInvalidMutation,
    "publish must ignore array-shaped career states");
  assert.equal(invalidArrayMutation.store.markDirty([]), revisionBeforeInvalidMutation,
    "markDirty must ignore array-shaped career states");
  assert.strictEqual(invalidArrayMutation.store.getState(), authoritativeCareer,
    "invalid array mutations must not replace the authoritative career object");

  const invalidArraySave = createHarness();
  const revisionBeforeInvalidSave = invalidArraySave.store.getRevision();
  await assert.rejects(invalidArraySave.store.save([]), /Invalid career save/,
    "the save repository must reject array-shaped career payloads");
  assert.equal(invalidArraySave.writes.length, 0,
    "an array-shaped career must never be written to IndexedDB");
  assert.equal(invalidArraySave.store.getRevision(), revisionBeforeInvalidSave,
    "rejecting an array save must not publish or mutate the active career");

  const invalidArrayLoad = createHarness();
  await invalidArrayLoad.resolveStartupRead(null);
  const invalidArrayLoadPromise = invalidArrayLoad.store.load();
  const invalidArrayLoadRequest = await invalidArrayLoad.waitForRead(1);
  invalidArrayLoadRequest.result = { id: "career:default", state: [] };
  invalidArrayLoadRequest.onsuccess();
  assert.equal(await invalidArrayLoadPromise, null,
    "explicit load must treat an array-shaped IndexedDB payload as an invalid save");
  assert.equal(invalidArrayLoad.store.getState(), null,
    "an invalid array payload must not be published by explicit load");
  assert.equal(invalidArrayLoad.store.getStartupSave(), null);

  const nullPrototypeCareer = Object.create(null);
  nullPrototypeCareer.name = "Null-prototype legacy career";
  nullPrototypeCareer.money = 900;
  const nullPrototypeStartup = createHarness();
  const nullPrototypeReady = await nullPrototypeStartup.resolveStartupRead({
    id: "career:default", state: nullPrototypeCareer
  });
  assert.equal(nullPrototypeReady.hasSave, true,
    "plain null-prototype records must remain valid career saves");
  assert.strictEqual(nullPrototypeStartup.store.getState(), nullPrototypeCareer,
    "cross-realm and null-prototype record support must preserve valid startup hydration");

  const invalidCareerShapes = [
    { label: "Date", make: () => new Date("2026-11-09T00:00:00.000Z") },
    { label: "Map", make: () => new Map([["name", "Not a career record"]]) },
    { label: "Set", make: () => new Set(["not", "a", "career"]) },
    { label: "RegExp", make: () => /career-save/ },
    { label: "typed array", make: () => new Uint8Array([1, 2, 3]) },
    { label: "class instance", make: () => new (class LegacyCareerRecord {})() },
    { label: "throwing proxy", make: () => new Proxy({}, {
      getPrototypeOf() { throw new Error("untrusted prototype trap"); }
    }) }
  ];

  for (const shape of invalidCareerShapes) {
    const invalidPayload = shape.make();

    const invalidStartup = createHarness();
    const invalidReady = await invalidStartup.resolveStartupRead({
      id: "career:default", state: invalidPayload
    });
    assert.equal(invalidReady.hasSave, false,
      shape.label + " payloads must not hydrate as career saves");
    assert.equal(invalidStartup.store.getState(), null);
    assert.equal(invalidStartup.store.getStartupSave(), null);

    const invalidMutation = createHarness();
    const preservedCareer = { name: "Preserved Career", money: 1200 };
    invalidMutation.store.publish(preservedCareer, { source: "import" });
    const beforeInvalidMutation = invalidMutation.store.getRevision();
    assert.equal(invalidMutation.store.publish(invalidPayload, { source: "import" }), beforeInvalidMutation,
      shape.label + " payloads must not replace the published career");
    assert.equal(invalidMutation.store.markDirty(invalidPayload), beforeInvalidMutation,
      shape.label + " payloads must not replace the dirty career");
    assert.strictEqual(invalidMutation.store.getState(), preservedCareer);

    const invalidSave = createHarness();
    await invalidSave.resolveStartupRead(null);
    const beforeInvalidSave = invalidSave.store.getRevision();
    await assert.rejects(invalidSave.store.save(invalidPayload), /Invalid career save/,
      shape.label + " payloads must be rejected before save cloning or IndexedDB writes");
    assert.equal(invalidSave.writes.length, 0);
    assert.equal(invalidSave.store.getRevision(), beforeInvalidSave);

    const invalidLoad = createHarness();
    await invalidLoad.resolveStartupRead(null);
    const invalidLoadPromise = invalidLoad.store.load();
    const invalidLoadRequest = await invalidLoad.waitForRead(1);
    invalidLoadRequest.result = { id: "career:default", state: invalidPayload };
    invalidLoadRequest.onsuccess();
    assert.equal(await invalidLoadPromise, null,
      shape.label + " payloads stored in IndexedDB must be ignored on explicit load");
    assert.equal(invalidLoad.store.getState(), null);
    assert.equal(invalidLoad.store.getStartupSave(), null);
  }
  const revokedSelector = createHarness();
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  revokedSelector.store.publish({ selected: revoked.proxy }, { source: "import" });
  let revokedNotifications = 0;
  assert.doesNotThrow(() => revokedSelector.store.subscribeSelector(
    state => state && state.selected,
    () => { revokedNotifications += 1; }
  ), "a selector returning a revoked proxy must not crash subscription setup");
  revokedSelector.store.publish({ selected: { recovered: true } }, { source: "import" });
  assert.equal(revokedNotifications, 1,
    "a selector must recover and notify after an unserializable revoked-proxy value");

  const circularSelector = createHarness();
  const circularValue = { label: "before" };
  circularValue.self = circularValue;
  const circularState = { selected: circularValue };
  circularSelector.store.publish(circularState, { source: "import" });
  let circularNotifications = 0;
  circularSelector.store.subscribeSelector(
    state => state && state.selected,
    () => { circularNotifications += 1; }
  );
  circularValue.label = "after";
  circularSelector.store.publish(circularState, { source: "save" });
  assert.equal(circularNotifications, 1,
    "circular selector values must notify on later observations instead of reusing a stale fallback signature");

  const revokedCallableSelector = createHarness();
  const revokedCallable = Proxy.revocable(function selectedCareerValue() {}, {});
  revokedCallable.revoke();
  revokedCallableSelector.store.publish({ selected: revokedCallable.proxy }, { source: "import" });
  let callableNotifications = 0;
  assert.doesNotThrow(() => revokedCallableSelector.store.subscribeSelector(
    state => state && state.selected,
    () => { callableNotifications += 1; }
  ), "a selector returning a revoked callable proxy must not crash subscription setup");
  revokedCallableSelector.store.publish({ selected: function recoveredCareerValue() {} }, { source: "import" });
  assert.equal(callableNotifications, 1,
    "a selector must recover and notify after an unserializable revoked callable proxy");

  const functionIdentitySelector = createHarness();
  const makeCapturedCareerAction = amount => function selectedCareerAction() { return amount; };
  const firstCareerAction = makeCapturedCareerAction(10);
  const secondCareerAction = makeCapturedCareerAction(20);
  assert.equal(String(firstCareerAction), String(secondCareerAction),
    "the regression must use distinct closures with identical source text");
  functionIdentitySelector.store.publish({ selected: firstCareerAction }, { source: "import" });
  let functionIdentityNotifications = 0;
  functionIdentitySelector.store.subscribeSelector(
    state => state && state.selected,
    () => { functionIdentityNotifications += 1; }
  );
  functionIdentitySelector.store.publish({ selected: firstCareerAction }, { source: "save" });
  assert.equal(functionIdentityNotifications, 0,
    "re-publishing the same function reference must not notify a selector subscriber");
  functionIdentitySelector.store.publish({ selected: secondCareerAction }, { source: "save" });
  assert.equal(functionIdentityNotifications, 1,
    "replacing a function with a different closure of identical source must notify the selector subscriber");

  const nestedObjectFunctionSelector = createHarness();
  const makeNestedCareerAction = amount => function nestedCareerAction() { return amount; };
  const firstNestedCareerAction = makeNestedCareerAction(30);
  const secondNestedCareerAction = makeNestedCareerAction(40);
  nestedObjectFunctionSelector.store.publish({
    selected: { actions: { primary: firstNestedCareerAction } }
  }, { source: "import" });
  let nestedObjectNotifications = 0;
  nestedObjectFunctionSelector.store.subscribeSelector(
    state => state && state.selected && state.selected.actions,
    () => { nestedObjectNotifications += 1; }
  );
  nestedObjectFunctionSelector.store.publish({
    selected: { actions: { primary: firstNestedCareerAction } }
  }, { source: "save" });
  assert.equal(nestedObjectNotifications, 0,
    "the same nested object function reference must keep its selector signature stable");
  nestedObjectFunctionSelector.store.publish({
    selected: { actions: { primary: secondNestedCareerAction } }
  }, { source: "save" });
  assert.equal(nestedObjectNotifications, 1,
    "a different closure nested in an object must notify selector subscribers");

  const nestedArrayFunctionSelector = createHarness();
  const firstArrayCareerAction = makeNestedCareerAction(50);
  const secondArrayCareerAction = makeNestedCareerAction(60);
  nestedArrayFunctionSelector.store.publish({
    selected: { actions: [firstArrayCareerAction] }
  }, { source: "import" });
  let nestedArrayNotifications = 0;
  nestedArrayFunctionSelector.store.subscribeSelector(
    state => state && state.selected && state.selected.actions,
    () => { nestedArrayNotifications += 1; }
  );
  nestedArrayFunctionSelector.store.publish({
    selected: { actions: [firstArrayCareerAction] }
  }, { source: "save" });
  assert.equal(nestedArrayNotifications, 0,
    "the same function inside an array must not produce a redundant selector notification");
  nestedArrayFunctionSelector.store.publish({
    selected: { actions: [secondArrayCareerAction] }
  }, { source: "save" });
  assert.equal(nestedArrayNotifications, 1,
    "a different closure inside an array must notify selector subscribers");

  console.log("PASS: delayed hydration, stale IndexedDB writes, queued mutations, and identity-safe selector signatures remain safe; completion-boundary flush requests are drained before the shared writer is released.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
